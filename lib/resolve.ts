import { ArtistSchema, type Artist } from "@/types";
import {
  getLatestRepostSet,
  getLatestSet,
  getTopReposts,
  getTopTracks,
  resolveUser,
  searchArtistCandidates,
  type SCUser,
} from "@/lib/soundcloud";
import { pickBestCandidate } from "@/lib/match";

/*
 * Turn poster names (from M2) into playable Artists (for M1). The cardinal rule:
 * resolvers NEVER throw — any miss or network/parse error yields an empty,
 * non-playable Artist so one bad name can't sink the whole lineup.
 *
 * Two failure modes this guards against (YOL-37 — real artists wrongly greyed out):
 *  1. Wrong/no account: search relevance alone picks a namesake or misses. We fetch
 *     several candidates and pick by name match (lib/match.ts), refusing weak guesses.
 *  2. A set-fetch blip discarding an already-resolved user: set-fetching failure now
 *     falls back to top tracks instead of collapsing the whole Artist to empty.
 */

// Manual pins for artists the search resolves wrongly (lowercased name → SC profile URL).
// Empty for now; wired so a known-bad mapping is a one-line fix, not new code.
const OVERRIDES: Record<string, string> = {};

/** "set vs single" threshold from SET_MIN_DURATION_MIN (default 20 min), in ms. */
function minDurationMs(): number {
  const raw = Number(process.env.SET_MIN_DURATION_MIN ?? 20);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : 20;
  return minutes * 60_000;
}

function emptyArtist(name: string): Artist {
  return {
    name,
    profileUrl: null,
    username: null,
    set: null,
    topTracks: [],
    setTime: null,
    setDay: null,
  };
}

/** The best matching account for a name, plus whether the pick was ambiguous. */
interface Chosen {
  user: SCUser;
  ambiguous: boolean;
  runnerUp: SCUser | null;
}

/** Choose the account for a name — override pin first, else best-scored search candidate. */
async function chooseUser(name: string): Promise<Chosen | null> {
  const pin = OVERRIDES[name.toLowerCase()];
  if (pin) {
    const pinned = await resolveUser(pin);
    if (pinned) return { user: pinned, ambiguous: false, runnerUp: null };
  }

  const candidates = await searchArtistCandidates(name);
  const pick = pickBestCandidate(name, candidates);
  return pick.user
    ? { user: pick.user, ambiguous: pick.ambiguous, runnerUp: pick.runnerUp }
    : null;
}

/**
 * Build a playable Artist from a chosen account. Fallback ladder, best first:
 *   1. the artist's own latest long set
 *   2. a long set they've *reposted* (many DJs upload nothing and repost the sets they
 *      play — the YOL-37 case: 0 own tracks looked "not found" despite reposted sets)
 *   3. their own top tracks
 *   4. their most recent reposted tracks
 * Each step is independently guarded: a blip fetching one never discards the resolved
 * account, which is how real artists were being greyed out.
 */
async function hydrate(name: string, user: SCUser): Promise<Artist> {
  const base = {
    name,
    profileUrl: user.permalinkUrl,
    username: user.username || null,
  };
  const min = minDurationMs();

  let set = await getLatestSet(user.id, min).catch(() => null);
  if (!set) set = await getLatestRepostSet(user.id, min).catch(() => null);

  let topTracks: Awaited<ReturnType<typeof getTopTracks>> = [];
  if (!set) {
    topTracks = await getTopTracks(user.id, 3).catch(() => []);
    if (topTracks.length === 0) topTracks = await getTopReposts(user.id, 3).catch(() => []);
  }

  // Validate the shape before handing it on; a parse failure degrades to empty.
  return ArtistSchema.parse({ ...base, set, topTracks });
}

/** The bucketed genre an Artist represents — its set's, else the most common top-track genre. */
function artistGenre(a: Artist): string | null {
  if (a.set?.genre) return a.set.genre;
  const counts = new Map<string, number>();
  for (const t of a.topTracks) {
    if (t.genre) counts.set(t.genre, (counts.get(t.genre) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [g, n] of counts) if (n > bestN) [best, bestN] = [g, n];
  return best;
}

/** Resolve one name. Never throws — returns an empty Artist on any miss/error. */
export async function resolveArtist(name: string): Promise<Artist> {
  try {
    const chosen = await chooseUser(name);
    if (!chosen) return emptyArtist(name);
    return await hydrate(name, chosen.user);
  } catch {
    return emptyArtist(name);
  }
}

/**
 * Bounded-parallel resolve. Concurrency is capped (~3) to stay polite to the
 * unofficial SoundCloud API — a wide fan-out gets rate-limited. Order is preserved.
 *
 * Two phases so ambiguous same-named accounts pick the one that fits the lineup:
 *  A. Choose + hydrate the best name-match for every name.
 *  B. For names whose pick was ambiguous, if a runner-up's genre matches the lineup's
 *     dominant genre (and the current pick's doesn't), swap to it. Bounded: only the few
 *     ambiguous names cost a second hydrate, so the common case stays one fetch per name.
 */
export async function resolveArtists(
  names: string[],
  { concurrency = 3 }: { concurrency?: number } = {},
): Promise<Artist[]> {
  const artists = new Array<Artist>(names.length);
  const chosen = new Array<Chosen | null>(names.length);

  // Phase A — pick + hydrate, bounded concurrency, order preserved.
  await runBounded(names.length, concurrency, async (i) => {
    try {
      const c = await chooseUser(names[i]);
      chosen[i] = c;
      artists[i] = c ? await hydrate(names[i], c.user) : emptyArtist(names[i]);
    } catch {
      chosen[i] = null;
      artists[i] = emptyArtist(names[i]);
    }
  });

  // Dominant genre from the *confident* picks — the lineup's centre of gravity.
  const dominant = dominantGenre(
    artists.filter((_, i) => chosen[i] && !chosen[i]!.ambiguous),
  );

  // Phase B — genre-coherent disambiguation for ambiguous picks only.
  if (dominant) {
    const ambiguous = names
      .map((_, i) => i)
      .filter((i) => chosen[i]?.ambiguous && chosen[i]?.runnerUp);
    await runBounded(ambiguous.length, concurrency, async (k) => {
      const i = ambiguous[k];
      const runnerUp = chosen[i]!.runnerUp!;
      try {
        const currentGenre = artistGenre(artists[i]);
        if (currentGenre === dominant) return; // pick already fits — leave it
        const alt = await hydrate(names[i], runnerUp);
        if (artistGenre(alt) === dominant) artists[i] = alt;
      } catch {
        /* keep the phase-A pick on any error */
      }
    });
  }

  return artists;
}

/** Most-represented genre across artists; null when nothing is tagged. */
function dominantGenre(artists: Artist[]): string | null {
  const counts = new Map<string, number>();
  for (const a of artists) {
    const g = artistGenre(a);
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [g, n] of counts) if (n > bestN) [best, bestN] = [g, n];
  return best;
}

/** Run `task(i)` for i in [0,count) with at most `concurrency` in flight. */
async function runBounded(
  count: number,
  concurrency: number,
  task: (i: number) => Promise<void>,
): Promise<void> {
  if (count === 0) return;
  let cursor = 0;
  const workers = Math.max(1, Math.min(concurrency, count));
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= count) return;
        await task(i);
      }
    }),
  );
}
