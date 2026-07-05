import { config } from "dotenv";
config({ path: ".env.local" });

import { deriveGenres, listLineupsForGenreBackfill, updateLineupGenres } from "@/lib/db";
import { resolveArtists } from "@/lib/resolve";

/*
 * One-off backfill (YOL-33): existing lineups were saved before Track carried a `genre`
 * bucket, so the stored `artists` blob has none to derive from — this re-resolves each
 * lineup's artist names against SoundCloud to pick up fresh genre/tag data, then writes
 * just the denormalized `genres` column (the stored `artists`/schedule data is untouched).
 * Rows that end up with no matched genre stay `[]` — explicitly "untagged", not skipped.
 */
async function main() {
  const worklist = await listLineupsForGenreBackfill();
  console.log(`${worklist.length} lineup(s) to backfill`);

  let tagged = 0;
  for (const { slug, artists } of worklist) {
    const names = artists.map((a) => a.name);
    const resolved = await resolveArtists(names, { concurrency: 3 });
    const genres = deriveGenres(resolved);
    await updateLineupGenres(slug, genres);
    if (genres.length > 0) tagged++;
    console.log(`${slug.padEnd(30)} ${genres.length ? genres.join(", ") : "(untagged)"}`);
  }

  console.log(`\n${tagged}/${worklist.length} lineups tagged with at least one genre`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
