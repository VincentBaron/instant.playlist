import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { extractArtists } from "@/lib/anthropic";

/*
 * Real end-to-end vision check (costs one API call). We render a synthetic poster
 * with known names so the assertion is deterministic — no need for a real photo,
 * and no copyrighted artwork. sharp rasterizes the SVG to JPEG (the same lib we'll
 * use for HEIC→JPEG in M5).
 */
const FESTIVAL = "VERIFY FESTIVAL 2026";
const ARTISTS = ["Amelie Lens", "Mind Against", "Hector Oaks", "Sara Landry"];

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1400">
  <rect width="1000" height="1400" fill="#15120d"/>
  <text x="500" y="160" font-family="Helvetica, Arial, sans-serif" font-size="64"
        font-weight="bold" fill="#cbff3c" text-anchor="middle">${FESTIVAL}</text>
  ${ARTISTS.map(
    (name, i) =>
      `<text x="500" y="${360 + i * 180}" font-family="Helvetica, Arial, sans-serif" ` +
      `font-size="${88 - i * 12}" font-weight="bold" fill="#ede6d6" text-anchor="middle">` +
      `${name.toUpperCase()}</text>`,
  ).join("\n")}
  <text x="500" y="1320" font-family="Helvetica, Arial, sans-serif" font-size="28"
        fill="#877f70" text-anchor="middle">SATURDAY · MAIN STAGE · TICKETS AT EXAMPLE.COM</text>
</svg>`;

async function main() {
  const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
  writeFileSync("/tmp/m2-poster.jpg", jpeg); // handy to eyeball if a name is missed
  console.log(`rendered poster: /tmp/m2-poster.jpg (${jpeg.length} bytes)`);

  const result = await extractArtists(jpeg.toString("base64"), "image/jpeg");
  console.log("festival:", result.festival);
  console.log("artists:", result.artists);

  const got = new Set(result.artists.map((a) => a.toLowerCase()));
  const missing = ARTISTS.filter((a) => !got.has(a.toLowerCase()));
  const festivalOk =
    !!result.festival && result.festival.toLowerCase().includes("verify festival");

  const ok = missing.length === 0 && festivalOk;
  if (missing.length) console.log("MISSING artists:", missing);
  if (!festivalOk) console.log("festival not recognized");
  console.log(`\n${ok ? "✓ M2 OK" : "✗ M2 FAILED"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
