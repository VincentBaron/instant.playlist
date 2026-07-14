import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { extractArtists } from "@/lib/anthropic";
import { normalizePoster, posterBackdropDataUrl } from "@/lib/image";
import { resolveArtists } from "@/lib/resolve";
import {
  refundCredit,
  saveLineup,
  spendCredit,
  type SaveLineupOpts,
} from "@/lib/db";
import type { LineupRecord } from "@/types";

// Resolve fans out to SoundCloud — needs Node (not edge) and room to run.
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // ~8MB cap on the poster

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Vision read nothing playable off the input — a spent credit must be refunded. */
class EmptyLineupError extends Error {}

/** A name plus its optional festival schedule slot (from vision, or manual). */
type LineupEntry = { name: string; setTime?: string | null; setDay?: string | null };

/** Shared tail: resolve names → playable Artists → overlay schedule → save. Throws
 * EmptyLineupError when the input yielded no artists (callers map it to 422). */
async function buildLineup(
  entries: LineupEntry[],
  opts: SaveLineupOpts,
): Promise<LineupRecord> {
  if (entries.length === 0) throw new EmptyLineupError();
  const resolved = await resolveArtists(entries.map((e) => e.name)); // never throws, order-preserving
  // Overlay any poster-read schedule by position (resolveArtists preserves input order).
  const artists = resolved.map((a, i) => ({
    ...a,
    setTime: entries[i].setTime ?? null,
    setDay: entries[i].setDay ?? null,
  }));
  return saveLineup(artists, opts);
}

/**
 * Poster upload (multipart) → normalize → vision → resolve → save. This is the metered,
 * signed-in path: you must be logged in and have a credit. A credit is reserved BEFORE
 * the expensive vision call and refunded if the scan produces nothing / errors, so a
 * failed read never costs the user a scan.
 */
async function handleUpload(req: Request) {
  const uploadSession = await auth.api.getSession({ headers: req.headers });
  if (!uploadSession) return bad("sign in to scan a poster", 401);
  const userId = uploadSession.user.id;

  const form = await req.formData();
  const poster = form.get("poster");
  if (!(poster instanceof File)) return bad("expected a 'poster' file");
  if (poster.size > MAX_UPLOAD_BYTES) return bad("poster too large (max 8MB)", 413);

  // Reserve the credit (serialized per user) before doing any expensive work.
  const spend = await spendCredit(userId);
  if (!spend.ok) {
    return NextResponse.json(
      { error: "you're out of scans", code: "no_credits" },
      { status: 402 },
    );
  }

  try {
    const bytes = Buffer.from(await poster.arrayBuffer());
    let imageBase64: string;
    try {
      imageBase64 = await normalizePoster(bytes); // HEIC/PNG/WebP/JPEG → JPEG base64
    } catch {
      throw new EmptyLineupError(); // unreadable image — refund, not a charge
    }

    const extracted = await extractArtists(imageBase64, "image/jpeg");
    // A dimmed copy of the poster becomes the share-page backdrop. Never fatal — a backdrop
    // failure must not sink lineup creation (mirrors "resolvers never throw").
    const posterImage = await posterBackdropDataUrl(bytes).catch(() => null);
    const festivalField = form.get("festival");
    // extracted.artists already carry setTime/setDay when the poster was a schedule.
    const lineup = await buildLineup(extracted.artists, {
      title: stringField(form.get("title")),
      festival: stringField(festivalField) ?? extracted.festival,
      officialTicketUrl: stringField(form.get("officialTicketUrl")) ?? null,
      posterImage,
      ownerId: userId,
    });
    return NextResponse.json(
      { lineup, credits: spend.balance },
      { status: 201 },
    );
  } catch (err) {
    // Any failure past the reservation gives the credit back.
    await refundCredit(userId).catch(() => {});
    if (err instanceof EmptyLineupError) {
      return bad("no artists could be read from that poster", 422);
    }
    throw err; // real error → outer 500
  }
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

/**
 * JSON dev path: a hand-built artist list. Intentionally unauthenticated and unmetered —
 * it's the seam the verify scripts (scripts/*-verify.ts) drive. The real, user-facing
 * poster upload above is the gated one.
 */
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
  try {
    const lineup = await buildLineup(
      artists.map((name) => ({ name })), // JSON dev path: names only, no schedule
      {
        title,
        festival: festival ?? null,
        officialTicketUrl: officialTicketUrl ?? null,
      },
    );
    return NextResponse.json({ lineup }, { status: 201 });
  } catch (err) {
    if (err instanceof EmptyLineupError) {
      return bad("no artists could be read from the input", 422);
    }
    throw err;
  }
}

/**
 * Generate, resolve, and save a lineup. Multipart → poster image (auth'd + metered);
 * JSON → artist list (dev). Errors return `{ error }` with a proper status — never a
 * leaked stack.
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
