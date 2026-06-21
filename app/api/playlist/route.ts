import { NextResponse } from "next/server";
import { z } from "zod";
import { extractArtists } from "@/lib/anthropic";
import { normalizePoster, posterBackdropDataUrl } from "@/lib/image";
import { resolveArtists } from "@/lib/resolve";
import { saveLineup, type SaveLineupOpts } from "@/lib/db";

// Resolve fans out to SoundCloud — needs Node (not edge) and room to run.
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // ~8MB cap on the poster

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** A name plus its optional festival schedule slot (from vision, or manual). */
type LineupEntry = { name: string; setTime?: string | null; setDay?: string | null };

/** Shared tail: resolve names → playable Artists → overlay schedule → save → 201. */
async function buildAndSave(entries: LineupEntry[], opts: SaveLineupOpts) {
  if (entries.length === 0) return bad("no artists could be read from the input", 422);
  const resolved = await resolveArtists(entries.map((e) => e.name)); // never throws, order-preserving
  // Overlay any poster-read schedule by position (resolveArtists preserves input order).
  const artists = resolved.map((a, i) => ({
    ...a,
    setTime: entries[i].setTime ?? null,
    setDay: entries[i].setDay ?? null,
  }));
  const lineup = await saveLineup(artists, opts);
  return NextResponse.json({ lineup }, { status: 201 });
}

/** Poster upload (multipart) → normalize → vision → resolve → save. */
async function handleUpload(req: Request) {
  const form = await req.formData();
  const poster = form.get("poster");
  if (!(poster instanceof File)) return bad("expected a 'poster' file");
  if (poster.size > MAX_UPLOAD_BYTES) return bad("poster too large (max 8MB)", 413);

  const bytes = Buffer.from(await poster.arrayBuffer());
  let imageBase64: string;
  try {
    imageBase64 = await normalizePoster(bytes); // HEIC/PNG/WebP/JPEG → JPEG base64
  } catch {
    return bad("couldn't read that image — try a JPEG or PNG", 415);
  }

  const extracted = await extractArtists(imageBase64, "image/jpeg");
  // A dimmed copy of the poster becomes the share-page backdrop. Never fatal — a backdrop
  // failure must not sink lineup creation (mirrors "resolvers never throw").
  const posterImage = await posterBackdropDataUrl(bytes).catch(() => null);
  const festivalField = form.get("festival");
  // extracted.artists already carry setTime/setDay when the poster was a schedule.
  return buildAndSave(extracted.artists, {
    title: stringField(form.get("title")),
    festival: stringField(festivalField) ?? extracted.festival,
    officialTicketUrl: stringField(form.get("officialTicketUrl")) ?? null,
    posterImage,
  });
}

function stringField(v: FormDataEntryValue | null): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

const ArtistsRequest = z.object({
  artists: z.array(z.string().min(1)).min(1), // dev/manual path
  title: z.string().optional(),
  festival: z.string().optional(),
  officialTicketUrl: z.string().url().optional(),
});

/** JSON dev path: a hand-built artist list. */
async function handleJson(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return bad("invalid JSON body");
  }
  const parsed = ArtistsRequest.safeParse(json);
  if (!parsed.success) return bad("body must be { artists: string[] }");
  const { artists, title, festival, officialTicketUrl } = parsed.data;
  return buildAndSave(
    artists.map((name) => ({ name })), // JSON dev path: names only, no schedule
    {
      title,
      festival: festival ?? null,
      officialTicketUrl: officialTicketUrl ?? null,
    },
  );
}

/**
 * Generate, resolve, and save a lineup. Multipart → poster image; JSON → artist list.
 * Errors return `{ error }` with a proper status — never a leaked stack.
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    return contentType.includes("multipart/form-data")
      ? await handleUpload(req)
      : await handleJson(req);
  } catch (err) {
    console.error("POST /api/playlist failed:", err);
    return bad("failed to build the lineup", 500);
  }
}
