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
import { creditLedger, lineups, patterns, patternVotes, user } from "@/lib/schema";
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

export function getDb() {
  if (!globalForDb._db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb._sql = postgres(url, {
      // Serverless-friendly (Vercel/Fly). `prepare: false` is REQUIRED when DATABASE_URL
      // points at a transaction pooler (Supabase/pgBouncer, Neon pooled endpoint) —
      // prepared statements aren't supported there and every query 500s ("works locally,
      // fails on Vercel"). Harmless on a direct connection. One connection per invocation,
      // released quickly, so we don't exhaust the pool across cold starts.
      prepare: false,
      max: 1,
      idle_timeout: 20,
      connect_timeout: 15,
    });
    globalForDb._db = drizzle(globalForDb._sql);
  }
  return globalForDb._db;
}

/*
 * Runtime safety net: create the auth + credit tables if a deploy didn't run migrations
 * (e.g. a Vercel build whose Build Command was overridden to `next build`, skipping
 * `drizzle-kit migrate`). Idempotent — every statement is IF NOT EXISTS, and an advisory
 * lock serializes concurrent cold starts so two instances can't race on the same DDL.
 * Runs at most once per process; a no-op when the migration already applied. DDL mirrors
 * drizzle/0004_auth_and_credits.sql — keep them in sync.
 */
const ENSURE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "user" ("id" text PRIMARY KEY NOT NULL, "name" text NOT NULL, "email" text NOT NULL, "email_verified" boolean DEFAULT false NOT NULL, "image" text, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL, CONSTRAINT "user_email_unique" UNIQUE("email"))`,
  `CREATE TABLE IF NOT EXISTS "session" ("id" text PRIMARY KEY NOT NULL, "expires_at" timestamp NOT NULL, "token" text NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL, "ip_address" text, "user_agent" text, "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE, CONSTRAINT "session_token_unique" UNIQUE("token"))`,
  `CREATE TABLE IF NOT EXISTS "account" ("id" text PRIMARY KEY NOT NULL, "account_id" text NOT NULL, "provider_id" text NOT NULL, "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE, "access_token" text, "refresh_token" text, "id_token" text, "access_token_expires_at" timestamp, "refresh_token_expires_at" timestamp, "scope" text, "password" text, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS "verification" ("id" text PRIMARY KEY NOT NULL, "identifier" text NOT NULL, "value" text NOT NULL, "expires_at" timestamp NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS "credit_ledger" ("id" serial PRIMARY KEY NOT NULL, "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE, "delta" integer NOT NULL, "reason" text NOT NULL, "idempotency_key" text, "created_at" timestamp with time zone DEFAULT now() NOT NULL, CONSTRAINT "credit_ledger_idempotency_key_unique" UNIQUE("idempotency_key"))`,
  `CREATE INDEX IF NOT EXISTS "credit_ledger_user_id_idx" ON "credit_ledger" ("user_id")`,
  `ALTER TABLE "lineups" ADD COLUMN IF NOT EXISTS "owner_id" text`,
];

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getDb()
      .transaction(async (tx) => {
        // 4927 = arbitrary constant lock id; serializes DDL across concurrent cold starts.
        await tx.execute(sql`select pg_advisory_xact_lock(4927)`);
        for (const stmt of ENSURE_SCHEMA_STATEMENTS) {
          await tx.execute(sql.raw(stmt));
        }
      })
      .catch((err) => {
        schemaReady = null; // let the next request retry rather than caching the failure
        throw err;
      });
  }
  return schemaReady;
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
    genres: row.genres,
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

/**
 * Rank genre buckets by how many artists' primary set falls in each (lib/genre.ts).
 * Artists with no set, or whose set's genre didn't match the taxonomy, don't count
 * toward any bucket — an empty result means the lineup is untagged, not "Other".
 */
export function deriveGenres(artists: Artist[]): string[] {
  const counts = new Map<string, number>();
  for (const a of artists) {
    const genre = a.set?.genre;
    if (!genre) continue;
    counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([bucket]) => bucket);
}

export type SaveLineupOpts = {
  title?: string;
  festival?: string | null;
  officialTicketUrl?: string | null;
  posterImage?: string | null;
  createdAt?: Date;
  ownerId?: string | null; // who scanned it; set on first insert only (re-scans don't transfer ownership)
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
  await ensureSchema(); // owner_id column must exist even if migrations didn't run
  const validated = ArtistsSchema.parse(artists);
  const festival = opts.festival ?? null;
  const title = opts.title ?? deriveTitle(validated, festival);
  const slug = slugify(festival ?? title) || "lineup";
  const artistCount = validated.length;
  const playableCount = countPlayable(validated);
  const genres = deriveGenres(validated);
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
      genres,
      artists: validated,
      posterImage,
      ownerId: opts.ownerId ?? null,
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
        genres,
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
      genres: lineups.genres,
    })
    .from(lineups)
    .orderBy(desc(lineups.createdAt));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/** slug + artist names for every lineup — the backfill script's re-resolve worklist. */
export async function listLineupsForGenreBackfill(): Promise<
  { slug: string; artists: Artist[] }[]
> {
  return getDb()
    .select({ slug: lineups.slug, artists: lineups.artists })
    .from(lineups);
}

/** Overwrite just the denormalized `genres` column (used by the one-off backfill). */
export async function updateLineupGenres(
  slug: string,
  genres: string[],
): Promise<void> {
  await getDb().update(lineups).set({ genres }).where(eq(lineups.slug, slug));
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

/* ── Credits ──────────────────────────────────────────────────────────────────────
 * Balance = SUM(delta) over a user's ledger rows (lib/schema.ts). Every mutation is one
 * append-only row; nothing is ever updated in place. See the schema comment for reasons.
 */

/** Free scans granted once per account. Env-overridable; defaults to 3. */
export const FREE_CREDITS = Math.max(0, Number(process.env.FREE_CREDITS ?? 3) || 0);

// Accepts the pool db or a transaction handle (same query-builder surface).
type DbOrTx =
  | ReturnType<typeof getDb>
  | Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** Sum a user's ledger (coalesce so a user with no rows reads 0, not null). */
async function sumBalance(db: DbOrTx, userId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${creditLedger.delta}), 0)`,
    })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId));
  return Number(row?.total ?? 0);
}

/**
 * Grant the free quota exactly once. The unique `idempotencyKey` ('signup:<userId>')
 * makes this a safe no-op on every call after the first — so we can lazily call it the
 * first time we ever need a user's balance, with no signup hook to keep in sync.
 */
export async function ensureSignupGrant(userId: string): Promise<void> {
  if (FREE_CREDITS <= 0) return;
  await ensureSchema(); // credit_ledger must exist even if migrations didn't run
  await getDb()
    .insert(creditLedger)
    .values({
      userId,
      delta: FREE_CREDITS,
      reason: "signup_free",
      idempotencyKey: `signup:${userId}`,
    })
    .onConflictDoNothing({ target: creditLedger.idempotencyKey });
}

/** A user's spendable balance (grants the free quota on first read). */
export async function getBalance(userId: string): Promise<number> {
  await ensureSignupGrant(userId);
  return sumBalance(getDb(), userId);
}

/**
 * Reserve one credit for a scan. Serialized per user by a transaction-scoped advisory
 * lock (hashtext(userId)), so two concurrent uploads can't both spend the last credit.
 * Returns the new balance on success, or ok:false with the unchanged balance when the
 * user is out of credits (the caller turns that into a 402 → paywall).
 */
export async function spendCredit(
  userId: string,
): Promise<{ ok: boolean; balance: number }> {
  await ensureSignupGrant(userId);
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const balance = await sumBalance(tx, userId);
    if (balance <= 0) return { ok: false, balance };
    await tx.insert(creditLedger).values({
      userId,
      delta: -1,
      reason: "poster_upload",
    });
    return { ok: true, balance: balance - 1 };
  });
}

/** Give back a reserved credit when the scan it paid for failed (unreadable / error). */
export async function refundCredit(userId: string): Promise<void> {
  await getDb()
    .insert(creditLedger)
    .values({ userId, delta: 1, reason: "refund" });
}

/**
 * Credit a completed purchase. `idempotencyKey` (e.g. 'bmc:<paymentId>') dedupes the
 * grant so at-least-once webhook retries never double-credit. Returns true only when a
 * row was actually inserted (false = already granted, a safe no-op).
 */
export async function addPurchaseCredits(
  userId: string,
  credits: number,
  idempotencyKey: string,
): Promise<boolean> {
  await ensureSchema();
  const inserted = await getDb()
    .insert(creditLedger)
    .values({
      userId,
      delta: credits,
      reason: "purchase",
      idempotencyKey,
    })
    .onConflictDoNothing({ target: creditLedger.idempotencyKey })
    .returning({ id: creditLedger.id });
  return inserted.length > 0;
}

/** Look up a user by email (case-insensitive) — the join key for BMC purchase grants. */
export async function getUserByEmail(
  email: string,
): Promise<{ id: string; email: string } | null> {
  await ensureSchema();
  const [row] = await getDb()
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(sql`lower(${user.email}) = lower(${email})`)
    .limit(1);
  return row ?? null;
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
