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
  },
  {
    name: "Unknown Act",
    profileUrl: null,
    username: null,
    set: null,
    topTracks: [],
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

  // Same festival → slug must dedupe to "dour-2026-2"
  const b = await saveLineup(artists, { festival: "Dour 2026" });
  console.log("saved #2 (dedupe):", b.slug);

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

  // Assertions (rerun-safe: don't hardcode exact suffixes, the DB may not be empty)
  const ok =
    a.playableCount === 3 &&
    a.slug.startsWith("dour-2026") &&
    b.slug !== a.slug &&
    b.slug.startsWith("dour-2026") &&
    fetched?.artists.length === 3 &&
    missing === null;
  console.log(`\n${ok ? "✓ M1 OK" : "✗ M1 FAILED"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
