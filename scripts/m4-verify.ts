/*
 * Hits the running dev server (:3001) end-to-end: create via the dev artists path
 * (real resolve + save), then read back via list and by-slug, plus a 400 check.
 * Requires `npm run dev` to be up.
 */
export {}; // module scope (no imports otherwise — avoids global redeclare collisions)

const BASE = "http://localhost:3001";

async function main() {
  // 1. Create (artists path → real SoundCloud resolve + DB save)
  const createRes = await fetch(`${BASE}/api/playlist`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      artists: ["Amelie Lens", "Charlotte de Witte"],
      festival: "API Test Fest 2026",
    }),
  });
  const created = await createRes.json();
  console.log("POST /api/playlist →", createRes.status, {
    slug: created.lineup?.slug,
    playableCount: created.lineup?.playableCount,
    artistCount: created.lineup?.artistCount,
  });
  const slug: string | undefined = created.lineup?.slug;

  // 2. List
  const listRes = await fetch(`${BASE}/api/lineups`);
  const list = await listRes.json();
  const inList = list.lineups?.some((l: { slug: string }) => l.slug === slug);
  console.log(`GET /api/lineups → ${listRes.status}, ${list.lineups?.length} rows, contains new: ${inList}`);

  // 3. Get by slug
  const getRes = await fetch(`${BASE}/api/lineups/${slug}`);
  const got = await getRes.json();
  console.log(`GET /api/lineups/${slug} → ${getRes.status}, artists: ${got.lineup?.artists?.length}`);

  // 4. Missing slug → 404
  const missRes = await fetch(`${BASE}/api/lineups/does-not-exist`);
  console.log(`GET /api/lineups/does-not-exist → ${missRes.status}`);

  // 5. Bad body → 400
  const badRes = await fetch(`${BASE}/api/playlist`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nope: true }),
  });
  console.log(`POST /api/playlist (bad body) → ${badRes.status}`);

  const ok =
    createRes.status === 201 &&
    !!slug &&
    created.lineup.artistCount === 2 &&
    listRes.status === 200 &&
    inList === true &&
    getRes.status === 200 &&
    got.lineup?.artists?.length === 2 &&
    missRes.status === 404 &&
    badRes.status === 400;

  console.log(`\n${ok ? "✓ M4 OK" : "✗ M4 FAILED"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
