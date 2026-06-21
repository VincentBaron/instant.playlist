/*
 * Verifies the public lineup page (:3001). Create a lineup via the dev artists path,
 * then GET /{slug} and assert the hero renders: festival, the artist names (SSR'd from
 * the client LineupView), the QR data URL, share controls, and the grain field. Plus
 * a missing slug → 404. Requires `npm run dev`.
 *
 * Note: actual SoundCloud playback (widget iframe) is a browser-only behavior and is
 * not exercised here — this checks the server-rendered hero + QR + 404.
 */
export {}; // module scope (no imports otherwise — avoids global redeclare collisions)

const BASE = "http://localhost:3001";
const FESTIVAL = "HERO TEST FEST 2026";
const ARTISTS = ["Amelie Lens", "Charlotte de Witte"];

async function main() {
  const createRes = await fetch(`${BASE}/api/playlist`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ artists: ARTISTS, festival: FESTIVAL }),
  });
  const created = await createRes.json();
  const slug: string | undefined = created.lineup?.slug;
  console.log("created:", createRes.status, slug);

  const pageRes = await fetch(`${BASE}/${slug}`);
  const html = await pageRes.text();
  const checks = {
    status: pageRes.status === 200,
    festival: html.includes(FESTIVAL),
    artist0: html.includes(ARTISTS[0]),
    artist1: html.includes(ARTISTS[1]),
    qr: html.includes("data:image/png;base64,"),
    share: html.toLowerCase().includes("share"),
    grain: html.includes("grain"),
  };
  console.log("GET /" + slug, checks);

  const missRes = await fetch(`${BASE}/no-such-lineup-xyz`);
  console.log("GET /no-such-lineup-xyz →", missRes.status);

  const ok =
    !!slug &&
    Object.values(checks).every(Boolean) &&
    missRes.status === 404;
  console.log(`\n${ok ? "✓ M6 OK" : "✗ M6 FAILED"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
