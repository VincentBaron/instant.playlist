import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/*
 * Vision: poster image → artist names. Server-side only (reads ANTHROPIC_API_KEY).
 *
 * Model id, base64 image-block shape, and the forced-tool-call shape were confirmed
 * against the claude-api skill — don't hardcode these from memory. We force a single
 * `submit_artists` tool call so the model must return structured JSON; `thinking` is
 * intentionally omitted (forced tool_choice + thinking can 400, and Opus 4.8 runs
 * fine without it for a one-shot extraction).
 */
const MODEL = "claude-opus-4-8";

export type SupportedMediaType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/gif";

export type ExtractedArtist = {
  name: string;
  setTime: string | null; // 24h "HH:MM" if the poster shows a slot time
  setDay: string | null; // short day label, e.g. "Fri", if the poster groups by day
};

export type ExtractResult = {
  festival: string | null;
  artists: ExtractedArtist[];
};

// Shape the forced tool call must satisfy. We still validate the model's output
// rather than trusting it blind. time/day are optional — most posters are name-only.
const SubmitArtistsSchema = z.object({
  festival: z.string().optional(),
  artists: z.array(
    z.object({
      name: z.string(),
      time: z.string().optional(),
      day: z.string().optional(),
    }),
  ),
});

const PROMPT = `You are reading a festival or club lineup poster. Extract the bill.

Rules:
- List every artist exactly as written on the poster, preserving the poster's order
  (headliners first, down to the undercard).
- Identify the festival/event name. If you are not confident, leave it blank.
- Exclude festival metadata from the artist list itself: dates, stage names, venue
  names, sponsors, ticket info, taglines are NOT artists.
- If — and only if — the poster is a timetable/schedule that shows when an act plays,
  attach that act's start time as "time" in 24-hour "HH:MM" (convert "10:30 PM" → "22:30"),
  and the day it plays as a short "day" label (e.g. "Fri", "Sat", "Day 1"). If a poster
  is just a list of names with no schedule, omit time and day entirely — do not guess them.
- Split true back-to-back / collaboration billings into separate artists ONLY when
  they are clearly distinct acts — separators like "b2b", "&", "x", "vs", "+", "×".
  When a name is a single act that happens to contain those characters, keep it whole.
  (Two acts sharing one slot get the same time/day.)
- Invent nothing. If you can't read a name, omit it rather than guessing.`;

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  // Lazy so importing this module doesn't require the key (e.g. in tests/build).
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

/** Normalize a raw time string to 24h "HH:MM", or null if it isn't a usable time. */
function normalizeTime(raw: string | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/**
 * Trim, drop empties, dedupe case-insensitively while preserving first-seen order.
 * The first occurrence of a name keeps its schedule (time/day) if present.
 */
function cleanArtists(
  raw: Array<{ name: string; time?: string; day?: string }>,
): ExtractedArtist[] {
  const seen = new Set<string>();
  const out: ExtractedArtist[] = [];
  for (const entry of raw) {
    const trimmed = entry.name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const day = entry.day?.trim();
    out.push({
      name: trimmed,
      setTime: normalizeTime(entry.time),
      setDay: day && day.length > 0 ? day : null,
    });
  }
  return out;
}

/**
 * Read a poster image and return the festival name + ordered artist list.
 * Throws on a missing key or API failure — the pipeline route (M4) catches and
 * returns a clean `{ error }`. (This is the network edge, not a resolver.)
 */
export async function extractArtists(
  imageBase64: string,
  mediaType: SupportedMediaType,
): Promise<ExtractResult> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [
      {
        name: "submit_artists",
        description: "Submit the festival name and the ordered list of artists read off the poster.",
        input_schema: {
          type: "object",
          properties: {
            festival: {
              type: "string",
              description: "The festival/event name, or omit if unsure.",
            },
            artists: {
              type: "array",
              description: "Every artist exactly as written, in poster order.",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "The artist name exactly as written.",
                  },
                  time: {
                    type: "string",
                    description:
                      'Start time in 24h "HH:MM" if the poster is a schedule; omit otherwise.',
                  },
                  day: {
                    type: "string",
                    description:
                      'Short day label (e.g. "Fri") if the poster groups acts by day; omit otherwise.',
                  },
                },
                required: ["name"],
                additionalProperties: false,
              },
            },
          },
          required: ["artists"],
          additionalProperties: false,
        },
      },
    ],
    // Force the tool call so the model must return structured JSON.
    tool_choice: { type: "tool", name: "submit_artists" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("vision: model did not return a submit_artists tool call");
  }

  const parsed = SubmitArtistsSchema.parse(toolUse.input);
  const festival = parsed.festival?.trim();
  return {
    festival: festival && festival.length > 0 ? festival : null,
    artists: cleanArtists(parsed.artists),
  };
}
