import { randomBytes, createHash } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  ArtistsSchema,
  type Artist,
  type LineupRecord,
  type LineupSummary,
} from "@/types";
import { lineups, patterns, patternVotes } from "@/lib/schema";
import { clampGrain, type Pattern } from "@/lib/themes";

/*
 * Side effects live here. Server-side only — never import this into a client component
 * (it reads DATABASE_URL and opens a Postgres pool).
 *
 * Lazy singleton: one pool per process, stashed on globalThis so Next's dev HMR doesn't
 * open a new pool on every reload.
 */
const globalForDb = globalThis as unknown as {
  _sql?: postgres.Sql;
  _db?: ReturnType<typeof drizzle>;
};

function getDb() {
  if (!globalForDb._db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb._sql = postgres(url);
    globalForDb._db = drizzle(globalForDb._sql);
  }
  return globalForDb._db;
}

type LineupRow = typeof lineups.$inferSelect;

function toRecord(row: LineupRow): LineupRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    festival: row.festival,
    officialTicketUrl: row.officialTicketUrl,
    createdAt: row.createdAt.toISOString(),
    artistCount: row.artistCount,
    playableCount: row.playableCount,
    artists: row.artists,
    posterImage: row.posterImage,
  };
}

/** Lowercase, hyphenate, strip anything that isn't url-safe. Pure. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** A human label when no festival name is known: first ~3 artists + "+N". */
function deriveTitle(artists: Artist[], festival: string | null): string {
  if (festival) return festival;
  const names = artists.map((a) => a.name).filter(Boolean);
  const head = names.slice(0, 3).join(", ");
  const rest = names.length - 3;
  return rest > 0 ? `${head} +${rest}` : head || "Lineup";
}

/** A `set` counts once; otherwise each fallback top track is independently playable. */
function countPlayable(artists: Artist[]): number {
  return artists.reduce((n, a) => n + (a.set ? 1 : a.topTracks.length), 0);
}

export type SaveLineupOpts = {
  title?: string;
  festival?: string | null;
  officialTicketUrl?: string | null;
  posterImage?: string | null;
  createdAt?: Date;
};

/**
 * Persist a resolved lineup. One canonical lineup per slug: the slug is the lineup's
 * identity (the festival name, or a derived label), so re-scanning the same poster
 * UPSERTS — it refreshes the existing lineup rather than creating a numbered duplicate
 * in the public index. created_at is preserved across updates (first-seen wins).
 */
export async function saveLineup(
  artists: Artist[],
  opts: SaveLineupOpts = {},
): Promise<LineupRecord> {
  const validated = ArtistsSchema.parse(artists);
  const festival = opts.festival ?? null;
  const title = opts.title ?? deriveTitle(validated, festival);
  const slug = slugify(festival ?? title) || "lineup";
  const artistCount = validated.length;
  const playableCount = countPlayable(validated);
  const officialTicketUrl = opts.officialTicketUrl ?? null;
  const posterImage = opts.posterImage ?? null;

  const [row] = await getDb()
    .insert(lineups)
    .values({
      slug,
      title,
      festival,
      officialTicketUrl,
      artistCount,
      playableCount,
      artists: validated,
      posterImage,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    })
    .onConflictDoUpdate({
      target: lineups.slug,
      set: {
        title,
        festival,
        officialTicketUrl,
        artistCount,
        playableCount,
        artists: validated,
        posterImage,
      },
    })
    .returning();
  return toRecord(row);
}

/** Newest first, without the heavy artists blob — for the public index. */
export async function listLineups(): Promise<LineupSummary[]> {
  const rows = await getDb()
    .select({
      id: lineups.id,
      slug: lineups.slug,
      title: lineups.title,
      festival: lineups.festival,
      officialTicketUrl: lineups.officialTicketUrl,
      createdAt: lineups.createdAt,
      artistCount: lineups.artistCount,
      playableCount: lineups.playableCount,
    })
    .from(lineups)
    .orderBy(desc(lineups.createdAt));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/** Public read for the shareable page. Returns null when the slug doesn't exist. */
export async function getLineupBySlug(
  slug: string,
): Promise<LineupRecord | null> {
  const [row] = await getDb()
    .select()
    .from(lineups)
    .where(eq(lineups.slug, slug))
    .limit(1);
  return row ? toRecord(row) : null;
}

/** One artist's schedule edit, keyed by position in the stored artists array. */
export type ScheduleEdit = { index: number; setTime: string | null; setDay: string | null };

/**
 * Apply crowd-sourced set-time edits to a lineup's artists (anonymous, no auth in MVP).
 * Edits are keyed by array index — the public page renders a stable index per artist.
 * Re-parsing the merged array also backfills defaults (bpm/setTime/setDay) on older rows.
 * Returns the updated record, or null if the slug doesn't exist.
 */
export async function updateLineupSchedule(
  slug: string,
  edits: ScheduleEdit[],
): Promise<LineupRecord | null> {
  const [existing] = await getDb()
    .select()
    .from(lineups)
    .where(eq(lineups.slug, slug))
    .limit(1);
  if (!existing) return null;

  const byIndex = new Map(edits.map((e) => [e.index, e]));
  const merged = existing.artists.map((a, i) => {
    const e = byIndex.get(i);
    return e ? { ...a, setTime: e.setTime, setDay: e.setDay } : a;
  });
  const validated = ArtistsSchema.parse(merged);

  const [row] = await getDb()
    .update(lineups)
    .set({ artists: validated })
    .where(eq(lineups.slug, slug))
    .returning();
  return row ? toRecord(row) : null;
}

/* ── Community patterns ─────────────────────────────────────────────────────────────
 * Anonymous, curated-color theme submissions per lineup. Top-voted = the default look.
 * Identity = the secret `token` (creator's private link). No auth anywhere.
 */
const MAX_PATTERNS = 10;

type PatternRow = typeof patterns.$inferSelect;

/** Public shape (no secret token) — what voters/visitors see. grain back to a 0..1 float. */
export type PatternPublic = {
  id: number;
  from: string;
  to: string;
  accent: string;
  grain: number;
  votes: number;
  selected: boolean;
  published: boolean;
};
export type PatternCreated = PatternPublic & { token: string };
export type PatternStatus = PatternCreated & { lineupSlug: string };

function toPatternPublic(row: PatternRow): PatternPublic {
  return {
    id: row.id,
    from: row.bgFrom,
    to: row.bgTo,
    accent: row.accent,
    grain: row.grain / 100,
    votes: row.votes,
    selected: row.selected,
    published: row.published,
  };
}

/** sha256(ip|user-agent) — the per-voter fingerprint behind dedupe. */
export function voterHash(ip: string, userAgent: string): string {
  return createHash("sha256").update(`${ip}|${userAgent}`).digest("hex");
}

/**
 * Post a new pattern for a lineup. Enforces the 10-cap: when full, the lowest-voted (then
 * oldest) live pattern is archived so a fresh submission always gets a slot to climb from.
 * Returns the created row INCLUDING its secret token (the creator's private link).
 */
export async function createPattern(
  slug: string,
  p: Pattern,
): Promise<PatternCreated> {
  const db = getDb();
  const live = await db
    .select()
    .from(patterns)
    .where(and(eq(patterns.lineupSlug, slug), eq(patterns.archived, false)))
    .orderBy(asc(patterns.votes), asc(patterns.createdAt));

  if (live.length >= MAX_PATTERNS) {
    await db
      .update(patterns)
      .set({ archived: true })
      .where(eq(patterns.id, live[0].id));
  }

  const [row] = await db
    .insert(patterns)
    .values({
      token: randomBytes(9).toString("base64url"),
      lineupSlug: slug,
      bgFrom: p.from,
      bgTo: p.to,
      accent: p.accent,
      grain: Math.round(clampGrain(p.grain) * 100),
    })
    .returning();
  return { ...toPatternPublic(row), token: row.token };
}

/** Live patterns for a lineup, best first (votes desc, oldest tiebreak). */
export async function listPatterns(slug: string): Promise<PatternPublic[]> {
  const rows = await getDb()
    .select()
    .from(patterns)
    .where(and(eq(patterns.lineupSlug, slug), eq(patterns.archived, false)))
    .orderBy(desc(patterns.votes), asc(patterns.createdAt))
    .limit(MAX_PATTERNS);
  return rows.map(toPatternPublic);
}

/** The lineup's default look: the top-voted live pattern, or null if none posted yet. */
export async function getTopPattern(slug: string): Promise<PatternPublic | null> {
  const [row] = await getDb()
    .select()
    .from(patterns)
    .where(and(eq(patterns.lineupSlug, slug), eq(patterns.archived, false)))
    .orderBy(desc(patterns.votes), asc(patterns.createdAt))
    .limit(1);
  return row ? toPatternPublic(row) : null;
}

/**
 * Cast a vote. Idempotent per (pattern, voter): the dedupe row is inserted first and the
 * counter only bumps when that insert is new. Returns { ok:false } if already voted or the
 * pattern doesn't belong to this lineup / is archived.
 */
export async function votePattern(
  slug: string,
  patternId: number,
  hash: string,
): Promise<{ ok: boolean; votes: number | null }> {
  const db = getDb();
  const [p] = await db
    .select()
    .from(patterns)
    .where(
      and(
        eq(patterns.id, patternId),
        eq(patterns.lineupSlug, slug),
        eq(patterns.archived, false),
      ),
    )
    .limit(1);
  if (!p) return { ok: false, votes: null };

  const inserted = await db
    .insert(patternVotes)
    .values({ patternId, voterHash: hash })
    .onConflictDoNothing()
    .returning();
  if (inserted.length === 0) return { ok: false, votes: p.votes }; // already voted

  const [updated] = await db
    .update(patterns)
    .set({ votes: sql`${patterns.votes} + 1` })
    .where(eq(patterns.id, patternId))
    .returning();
  return { ok: true, votes: updated.votes };
}

/** The creator's private view, looked up by their secret token. */
export async function getPatternByToken(
  token: string,
): Promise<PatternStatus | null> {
  const [row] = await getDb()
    .select()
    .from(patterns)
    .where(eq(patterns.token, token))
    .limit(1);
  if (!row) return null;
  return {
    ...toPatternPublic(row),
    token: row.token,
    lineupSlug: row.lineupSlug,
  };
}
