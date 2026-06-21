import sharp from "sharp";

/*
 * Normalize an uploaded poster (iPhone HEIC, PNG, WebP, big JPEG) into a base64 JPEG
 * the vision model accepts. Server-side only (sharp is a native module).
 *
 * - EXIF orientation applied (phone photos are often rotated).
 * - Downscaled to a sane long edge to keep vision tokens/cost bounded.
 */
const MAX_DIMENSION = 2000; // long edge; plenty for reading a lineup, modest token cost

export async function normalizePoster(bytes: Buffer): Promise<string> {
  const jpeg = await sharp(bytes)
    .rotate() // honor EXIF orientation
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
  return jpeg.toString("base64");
}

/*
 * A small, dimmed-backdrop variant of the poster for the share page (the lineup is typeset
 * on top of it). Kept tiny — long edge 800px, q70 — so the stored data URL stays light
 * (~tens of KB), not the ~1MB vision image. Returns a ready-to-use `data:` URL.
 */
export async function posterBackdropDataUrl(bytes: Buffer): Promise<string> {
  const jpeg = await sharp(bytes)
    .rotate() // honor EXIF orientation
    .resize({
      width: 800,
      height: 800,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 70 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}
