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
