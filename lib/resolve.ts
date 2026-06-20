import { ArtistSchema, type Artist } from "@/types";
import {
  getLatestSet,
  getTopTracks,
  resolveUser,
  searchArtist,
  type SCUser,
} from "@/lib/soundcloud";

/*
 * Turn poster names (from M2) into playable Artists (for M1). The cardinal rule:
 * resolvers NEVER throw — any miss or network/parse error yields an empty,
 * non-playable Artist so one bad name can't sink the whole lineup.
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
  return { name, profileUrl: null, username: null, set: null, topTracks: [] };
}

async function findUser(name: string): Promise<SCUser | null> {
  const pin = OVERRIDES[name.toLowerCase()];
  if (pin) {
    const pinned = await resolveUser(pin);
    if (pinned) return pinned;
  }
  return searchArtist(name);
}

/** Resolve one name. Never throws — returns an empty Artist on any miss/error. */
export async function resolveArtist(name: string): Promise<Artist> {
  try {
    const user = await findUser(name);
    if (!user) return emptyArtist(name);

    const base = {
      name,
      profileUrl: user.permalinkUrl,
      username: user.username || null,
    };

    // Prefer a long set; fall back to top tracks only when there's no set.
    const set = await getLatestSet(user.id, minDurationMs());
    const artist: Artist = set
      ? { ...base, set, topTracks: [] }
      : { ...base, set: null, topTracks: await getTopTracks(user.id, 3) };

    // Validate the shape before handing it on; a parse failure degrades to empty.
    return ArtistSchema.parse(artist);
  } catch {
    return emptyArtist(name);
  }
}

/**
 * Bounded-parallel resolve. Concurrency is capped (~3) to stay polite to the
 * unofficial SoundCloud API — a wide fan-out gets rate-limited. Order is preserved.
 */
export async function resolveArtists(
  names: string[],
  { concurrency = 3 }: { concurrency?: number } = {},
): Promise<Artist[]> {
  const results = new Array<Artist>(names.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= names.length) return;
      results[i] = await resolveArtist(names[i]);
    }
  }

  const workers = Math.max(1, Math.min(concurrency, names.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}
