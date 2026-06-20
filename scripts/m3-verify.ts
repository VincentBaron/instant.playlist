import { config } from "dotenv";
config({ path: ".env.local" });

import { resolveArtists } from "@/lib/resolve";

/*
 * Real end-to-end resolve check against the unofficial SoundCloud API.
 * Real DJs that should have long sets, plus a deliberate nonsense name that must
 * resolve to an empty, non-playable Artist WITHOUT throwing.
 */
const BOGUS = "zzqwx nonexistent artist 9381";
const NAMES = ["Amelie Lens", "Charlotte de Witte", "I Hate Models", BOGUS];

function playable(a: { set: unknown; topTracks: unknown[] }): boolean {
  return a.set !== null || a.topTracks.length > 0;
}

async function main() {
  const artists = await resolveArtists(NAMES, { concurrency: 3 });

  for (const a of artists) {
    const kind = a.set
      ? `set ${a.set.durationMin}min`
      : a.topTracks.length
        ? `${a.topTracks.length} top tracks`
        : "—";
    console.log(
      `${a.name.padEnd(26)} ${a.username ? "@" + a.username : "(unresolved)"}  ${kind}`,
    );
  }

  const order = artists.map((a) => a.name).join("|") === NAMES.join("|");
  const bogus = artists[artists.length - 1];
  const bogusEmpty = !playable(bogus) && bogus.profileUrl === null;
  const realPlayable = artists.slice(0, 3).filter(playable).length;

  console.log(
    `\norder preserved: ${order} · bogus empty: ${bogusEmpty} · real playable: ${realPlayable}/3`,
  );
  // At least one real DJ should resolve to something playable; bogus must be empty.
  const ok = order && bogusEmpty && realPlayable >= 1;
  console.log(`${ok ? "✓ M3 OK" : "✗ M3 FAILED"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
