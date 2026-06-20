import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  ArtistsSchema,
  type Artist,
  type LineupRecord,
  type LineupSummary,
} from "@/types";
import { lineups } from "@/lib/schema";

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

// Postgres unique-violation SQLSTATE is 23505. Drizzle wraps the driver error, so the
// code can sit on the error itself or on its `cause` — check both.
function isUniqueViolation(err: unknown): boolean {
  const code = (e: unknown) =>
    typeof e === "object" && e !== null && "code" in e
      ? (e as { code?: string }).code
      : undefined;
  const cause =
    typeof err === "object" && err !== null && "cause" in err
      ? (err as { cause?: unknown }).cause
      : undefined;
  return code(err) === "23505" || code(cause) === "23505";
}

export type SaveLineupOpts = {
  title?: string;
  festival?: string | null;
  officialTicketUrl?: string | null;
  createdAt?: Date;
};

/**
 * Persist a resolved lineup under a unique, deduped slug.
 * Slug collisions retry with `-2`, `-3`, … relying on the DB unique constraint as the
 * source of truth (also race-safe under concurrent inserts).
 */
export async function saveLineup(
  artists: Artist[],
  opts: SaveLineupOpts = {},
): Promise<LineupRecord> {
  const validated = ArtistsSchema.parse(artists);
  const festival = opts.festival ?? null;
  const title = opts.title ?? deriveTitle(validated, festival);
  const base = slugify(festival ?? title) || "lineup";
  const artistCount = validated.length;
  const playableCount = countPlayable(validated);

  for (let attempt = 0; attempt < 50; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    try {
      const [row] = await getDb()
        .insert(lineups)
        .values({
          slug,
          title,
          festival,
          officialTicketUrl: opts.officialTicketUrl ?? null,
          artistCount,
          playableCount,
          artists: validated,
          ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
        })
        .returning();
      return toRecord(row);
    } catch (err) {
      if (isUniqueViolation(err)) continue; // slug taken — try the next suffix
      throw err;
    }
  }
  throw new Error(`could not generate a unique slug for "${base}"`);
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
