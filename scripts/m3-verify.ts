import { config } from "dotenv";
config({ path: ".env.local" });

import { resolveArtists } from "@/lib/resolve";
import { slugOf } from "@/lib/match";

/*
 * Real end-to-end resolve check against the unofficial SoundCloud API.
 *
 * A battery of real DJs, each with the SoundCloud handle we expect to resolve to — so we
 * catch the YOL-37 failure mode (a real artist wrongly greyed out, or the wrong namesake
 * picked), not just "something resolved". Includes "Voltery" (the reported bug) and a
 * deliberate nonsense name that must resolve to an empty, non-playable Artist WITHOUT
 * throwing.
 *
 * Requires .env.local with SOUNDCLOUD_CLIENT_ID / SOUNDCLOUD_OAUTH_TOKEN.
 */
interface Case {
  name: string;
  expectHandle: string | null; // expected SoundCloud slug; null = must stay unresolved
  expectPlayable: boolean; // whether the artist must have a playable set/tracks of their own
}
const CASES: Case[] = [
  // Voltery only reposts other DJs' sets (0 own tracks) — resolves to the right account
  // but stays greyed out, because we deliberately never play reposts (YOL-37 feedback).
  { name: "Voltery", expectHandle: "voltery", expectPlayable: false },
  { name: "Amelie Lens", expectHandle: "amelielens", expectPlayable: true },
  { name: "Charlotte de Witte", expectHandle: "charlottedewittemusic", expectPlayable: true },
  { name: "I Hate Models", expectHandle: "ihatemodels", expectPlayable: true },
  { name: "zzqwx nonexistent artist 9381", expectHandle: null, expectPlayable: false },
];

function playable(a: { set: unknown; topTracks: unknown[] }): boolean {
  return a.set !== null || a.topTracks.length > 0;
}

async function main() {
  const artists = await resolveArtists(
    CASES.map((c) => c.name),
    { concurrency: 3 },
  );

  let failures = 0;
  artists.forEach((a, i) => {
    const c = CASES[i];
    const handle = a.profileUrl ? slugOf(a.profileUrl) : null;
    const kind = a.set
      ? `set ${a.set.durationMin}min`
      : a.topTracks.length
        ? `${a.topTracks.length} top tracks`
        : "—";

    // Right account (or deliberately unresolved) AND the expected playable/greyed state.
    const ok = handle === c.expectHandle && playable(a) === c.expectPlayable;
    if (!ok) failures++;

    const note = !ok
      ? `  (expected @${c.expectHandle ?? "unresolved"}, ${c.expectPlayable ? "playable" : "greyed"})`
      : c.expectPlayable
        ? ""
        : "  (greyed by design)";
    console.log(
      `${ok ? "✓" : "✗"} ${c.name.padEnd(28)} @${(handle ?? "unresolved").padEnd(20)} ${kind}${note}`,
    );
  });

  const order = artists.map((a) => a.name).join("|") === CASES.map((c) => c.name).join("|");
  console.log(`\norder preserved: ${order} · failures: ${failures}`);
  const ok = order && failures === 0;
  console.log(`${ok ? "✓ M3 OK" : "✗ M3 FAILED"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
