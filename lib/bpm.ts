/*
 * Pure tempo inference. SoundCloud's numeric `bpm` field is almost always empty for DJ
 * sets, but the `genre` / `tag_list` strings ("Techno", "Deep House", "Drum & Bass") are
 * usually present and map cleanly to known BPM ranges. No side effects.
 */

// Ordered most-specific first so "deep house" wins before "house" and "drum & bass"/"dnb"
// before a bare "bass". First substring match decides; representative BPM per genre family.
const GENRE_BPM: ReadonlyArray<[needle: string, bpm: number]> = [
  ["downtempo", 95],
  ["ambient", 90],
  ["lo-fi", 90],
  ["lofi", 90],
  ["chill", 95],
  ["hip hop", 95],
  ["hip-hop", 95],
  ["hiphop", 95],
  ["rap", 95],
  ["nu disco", 115],
  ["nu-disco", 115],
  ["disco", 115],
  ["funk", 115],
  ["deep house", 120],
  ["afro house", 122],
  ["afro", 120],
  ["tech house", 126],
  ["melodic", 124],
  ["progressive", 124],
  ["house", 124],
  ["minimal", 128],
  ["electro", 130],
  ["breakbeat", 130],
  ["breaks", 130],
  ["techno", 132],
  ["garage", 134],
  ["ukg", 134],
  ["trance", 138],
  ["dubstep", 140],
  ["hardstyle", 155],
  ["hardcore", 160],
  ["gabber", 175],
  ["drum & bass", 174],
  ["drum and bass", 174],
  ["drum n bass", 174],
  ["dnb", 174],
  ["d&b", 174],
  ["jungle", 174],
];

/**
 * Resolve a BPM for a track. Prefers an explicit numeric bpm in a sane range; otherwise
 * infers from genre + tag_list. Returns null when nothing matches (= unknown tempo).
 */
export function inferBpm(meta: {
  bpm?: number | null;
  genre?: string | null;
  tagList?: string | null;
}): number | null {
  if (
    typeof meta.bpm === "number" &&
    Number.isFinite(meta.bpm) &&
    meta.bpm >= 60 &&
    meta.bpm <= 220
  ) {
    return Math.round(meta.bpm);
  }

  const hay = `${meta.genre ?? ""} ${meta.tagList ?? ""}`.toLowerCase();
  for (const [needle, bpm] of GENRE_BPM) {
    if (hay.includes(needle)) return bpm;
  }
  return null;
}
