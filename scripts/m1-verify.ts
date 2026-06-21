import { config } from "dotenv";
config({ path: ".env.local" });

import type { Artist } from "@/types";
import { getLineupBySlug, listLineups, saveLineup } from "@/lib/db";

// A hand-built Artist[] standing in for what M3 (resolve) will produce — one artist
// with a long set, one with top-track fallbacks, one unresolved (non-playable).
const artists: Artist[] = [
  {
    name: "Kiasmos",
    profileUrl: "https://soundcloud.com/kiasmos",
    username: "kiasmos",
    set: {
      title: "Kiasmos — Boiler Room Reykjavík",
      url: "https://soundcloud.com/kiasmos/boiler-room",
      durationMin: 62,
      artworkUrl: null,
      bpm: null,
    },
    topTracks: [],
    setTime: null,
    setDay: null,
  },
  {
    name: "JUJU",
    profileUrl: "https://soundcloud.com/juju",
    username: "juju",
    set: null,
    topTracks: [
      {
        title: "JUJU — ID",
        url: "https://soundcloud.com/juju/id",
        durationMin: 6,
        artworkUrl: null,
        bpm: null,
      },
      {
        title: "JUJU — Live cut",
        url: "https://soundcloud.com/juju/live",
        durationMin: 8,
        artworkUrl: null,
        bpm: null,
      },
    ],
    setTime: null,
    setDay: null,
  },
  {
    name: "Unknown Act",
    profileUrl: null,
    username: null,
    set: null,
    topTracks: [],
    setTime: null,
    setDay: null,
  },
];

async function main() {
  // playableCount should be 1 (set) + 2 (top tracks) + 0 = 3
  const a = await saveLineup(artists, { festival: "Dour 2026" });
  console.log("saved #1:", {
    slug: a.slug,
    title: a.title,
    artistCount: a.artistCount,
    playableCount: a.playableCount,
  });

  // Same festival → UPSERT: same slug, no duplicate row
  const b = await saveLineup(artists, { festival: "Dour 2026" });
  console.log("saved #2 (upsert, same slug):", b.slug);

  // No festival → title derived from artist names
  const c = await saveLineup(artists);
  console.log("saved #3 (derived title):", { slug: c.slug, title: c.title });

  const list = await listLineups();
  console.log(`\nlistLineups → ${list.length} rows (newest first):`);
  for (const row of list) {
    console.log(`  ${row.slug}  ·  "${row.title}"  ·  ${row.playableCount} playable`);
  }

  const fetched = await getLineupBySlug(a.slug);
  console.log("\ngetLineupBySlug:", fetched?.slug, "→ artists:", fetched?.artists.length);

  const missing = await getLineupBySlug("does-not-exist");
  console.log("getLineupBySlug(missing) →", missing);

  // Re-scanning the same festival upserts: same slug, and only one dour-2026 row.
  const dourRows = list.filter((r) => r.slug === "dour-2026").length;
  const ok =
    a.playableCount === 3 &&
    a.slug === "dour-2026" &&
    b.slug === a.slug && // upsert, not a numbered duplicate
    dourRows === 1 && // exactly one canonical row
    fetched?.artists.length === 3 &&
    missing === null;
  console.log(`\n${ok ? "✓ M1 OK" : "✗ M1 FAILED"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
