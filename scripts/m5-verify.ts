/*
 * Verifies the M5 upload path against the running dev server (:3001):
 * render a synthetic poster (PNG, via sharp) → POST it as multipart to /api/playlist
 * → server normalizes (sharp) → vision → resolve → save. Also checks the landing renders.
 * Requires `npm run dev`.
 */
import sharp from "sharp";

const BASE = "http://localhost:3001";
const FESTIVAL = "UPLOAD TEST FEST 2026";
const ARTISTS = ["Amelie Lens", "Charlotte de Witte"];

async function makePosterPng(): Promise<Buffer> {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
  <rect width="900" height="1200" fill="#15120d"/>
  <text x="450" y="150" font-family="Helvetica, Arial, sans-serif" font-size="52"
        font-weight="bold" fill="#cbff3c" text-anchor="middle">${FESTIVAL}</text>
  ${ARTISTS.map(
    (n, i) =>
      `<text x="450" y="${380 + i * 200}" font-family="Helvetica, Arial, sans-serif" ` +
      `font-size="${84 - i * 10}" font-weight="bold" fill="#ede6d6" text-anchor="middle">${n.toUpperCase()}</text>`,
  ).join("\n")}
</svg>`;
  // PNG on purpose — proves the server-side normalize (→ JPEG) actually runs.
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  const png = await makePosterPng();
  const body = new FormData();
  body.append(
    "poster",
    new Blob([new Uint8Array(png)], { type: "image/png" }),
    "poster.png",
  );

  const res = await fetch(`${BASE}/api/playlist`, { method: "POST", body });
  const data = await res.json();
  console.log("POST /api/playlist (multipart png) →", res.status, {
    slug: data.lineup?.slug,
    festival: data.lineup?.festival,
    playableCount: data.lineup?.playableCount,
  });

  const home = await fetch(`${BASE}/`);
  const html = await home.text();
  const landingOk =
    home.status === 200 &&
    html.includes("Point at any poster") &&
    html.toLowerCase().includes("drop a festival poster");
  console.log(`GET / → ${home.status}, landing+dropzone rendered: ${landingOk}`);

  const ok =
    res.status === 201 &&
    !!data.lineup?.slug &&
    data.lineup.artistCount === 2 &&
    landingOk;
  console.log(`\n${ok ? "✓ M5 OK" : "✗ M5 FAILED"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
