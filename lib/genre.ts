/*
 * Pure genre bucketing. SoundCloud's `genre` / `tag_list` strings are free text ("Techno",
 * "Deep House", "live set", "vibes") — this maps the clean signal into a small fixed
 * taxonomy so lineups can be browsed/filtered by "type of music" later. Unmatched text
 * (blank, or junk like "vibes") intentionally falls through to null — an untagged set,
 * not a fake bucket. No side effects.
 */

// Ordered most-specific first so "deep house" wins before "house" and "drum & bass"/"dnb"
// before a bare "bass". First substring match decides.
const GENRE_TAXONOMY: ReadonlyArray<[needle: string, bucket: string]> = [
  ["hip hop", "Hip-Hop"],
  ["hip-hop", "Hip-Hop"],
  ["hiphop", "Hip-Hop"],
  ["rap", "Hip-Hop"],
  ["nu disco", "Disco/Funk"],
  ["nu-disco", "Disco/Funk"],
  ["disco", "Disco/Funk"],
  ["funk", "Disco/Funk"],
  ["deep house", "House"],
  ["afro house", "House"],
  ["tech house", "House"],
  ["house", "House"],
  ["techno", "Techno"],
  ["trance", "Trance"],
  ["drum & bass", "DnB/Bass"],
  ["drum and bass", "DnB/Bass"],
  ["drum n bass", "DnB/Bass"],
  ["dnb", "DnB/Bass"],
  ["d&b", "DnB/Bass"],
  ["jungle", "DnB/Bass"],
  ["dubstep", "DnB/Bass"],
  ["bass", "DnB/Bass"],
];

/**
 * Bucket a set's genre for the fixed taxonomy. Returns null when nothing matches (=
 * untagged), rather than a catch-all "Other" — a lineup mostly "Other" is as
 * unhelpful for browsing as one that's blank.
 */
export function inferGenre(meta: {
  genre?: string | null;
  tagList?: string | null;
}): string | null {
  const hay = `${meta.genre ?? ""} ${meta.tagList ?? ""}`.toLowerCase();
  for (const [needle, bucket] of GENRE_TAXONOMY) {
    if (hay.includes(needle)) return bucket;
  }
  return null;
}
