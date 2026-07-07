import { config } from "dotenv";
config({ path: ".env.local" });

import { searchArtistCandidates } from "@/lib/soundcloud";
import { pickBestCandidate, scoreCandidate, slugOf } from "@/lib/match";
import { resolveArtist } from "@/lib/resolve";

/*
 * YOL-37 diagnosis harness. For each name prints the raw search candidates SoundCloud
 * returns, the score our matcher gives each, which one we pick, and what the full resolve
 * ends up playing. Run against a lineup's names (defaults to the nido lineup incl. the
 * reported "Voltery") to see *why* an artist was greying out.
 *
 *   npx tsx scripts/diagnose-resolve.ts "Voltery" "Some Other Artist"
 */
const NAMES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["Voltery", "Amelie Lens", "zzqwx nonexistent artist 9381"];

async function main() {
  for (const name of NAMES) {
    console.log(`\n=== ${name} ===`);
    const candidates = await searchArtistCandidates(name);
    if (candidates.length === 0) {
      console.log("  (search returned no candidates)");
    }
    for (const c of candidates) {
      const score = scoreCandidate(name, c).toFixed(2);
      console.log(
        `  ${score}  @${slugOf(c.permalinkUrl).padEnd(24)} "${c.username}"  followers=${c.followersCount}`,
      );
    }
    const pick = pickBestCandidate(name, candidates);
    console.log(
      `  → pick: ${pick.user ? "@" + slugOf(pick.user.permalinkUrl) : "NONE (below threshold)"}` +
        `  score=${pick.score.toFixed(2)}  ambiguous=${pick.ambiguous}`,
    );

    const artist = await resolveArtist(name);
    const play = artist.set
      ? `set ${artist.set.durationMin}min (${artist.set.genre ?? "untagged"})`
      : artist.topTracks.length
        ? `${artist.topTracks.length} top tracks`
        : "— NON-PLAYABLE (greyed out)";
    console.log(`  → resolved: ${artist.username ? "@" + artist.username : "unresolved"}  ${play}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
