import { NextResponse } from "next/server";
import { z } from "zod";
import { extractArtists } from "@/lib/anthropic";
import { resolveArtists } from "@/lib/resolve";
import { saveLineup } from "@/lib/db";

// Resolve fans out to SoundCloud — needs Node (not edge) and room to run.
export const runtime = "nodejs";
export const maxDuration = 300;

const ImageRequest = z.object({
  image: z.string().min(1), // base64, no data: prefix
  mediaType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  title: z.string().optional(),
  festival: z.string().optional(),
  officialTicketUrl: z.string().url().optional(),
});

const ArtistsRequest = z.object({
  artists: z.array(z.string().min(1)).min(1), // dev/manual path
  title: z.string().optional(),
  festival: z.string().optional(),
  officialTicketUrl: z.string().url().optional(),
});

const Body = z.union([ImageRequest, ArtistsRequest]);

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Generate, resolve, and save a lineup. Accepts a poster image OR a hand-built
 * artist list (dev path). Returns the saved LineupRecord. Errors are returned as
 * `{ error }` with a proper status — never a leaked stack.
 */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return bad("invalid JSON body");
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return bad("body must be { image, mediaType } or { artists: string[] }");
  }
  const body = parsed.data;

  try {
    // Step 1: get the artist names (+ maybe a festival) — from vision or the body.
    let names: string[];
    let festival = body.festival ?? null;
    if ("image" in body) {
      const extracted = await extractArtists(body.image, body.mediaType);
      names = extracted.artists;
      festival = body.festival ?? extracted.festival;
    } else {
      names = body.artists;
    }

    if (names.length === 0) {
      return bad("no artists could be read from the input", 422);
    }

    // Step 2: resolve to playable Artists (never throws). Step 3: save under a slug.
    const artists = await resolveArtists(names);
    const lineup = await saveLineup(artists, {
      title: body.title,
      festival,
      officialTicketUrl: body.officialTicketUrl ?? null,
    });

    return NextResponse.json({ lineup }, { status: 201 });
  } catch (err) {
    // Vision/DB can throw; log server-side, return a clean message.
    console.error("POST /api/playlist failed:", err);
    return bad("failed to build the lineup", 500);
  }
}
