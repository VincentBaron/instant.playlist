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

export type ExtractResult = {
  festival: string | null;
  artists: string[];
};

// Shape the forced tool call must satisfy. We still validate the model's output
// rather than trusting it blind.
const SubmitArtistsSchema = z.object({
  festival: z.string().optional(),
  artists: z.array(z.string()),
});

const PROMPT = `You are reading a festival or club lineup poster. Extract the bill.

Rules:
- List every artist exactly as written on the poster, preserving the poster's order
  (headliners first, down to the undercard).
- Identify the festival/event name. If you are not confident, leave it blank.
- Exclude anything that is not a performing act: days, dates, times, stage names,
  venue names, sponsors, ticket info, taglines.
- Split true back-to-back / collaboration billings into separate artists ONLY when
  they are clearly distinct acts — separators like "b2b", "&", "x", "vs", "+", "×".
  When a name is a single act that happens to contain those characters, keep it whole.
- Invent nothing. If you can't read a name, omit it rather than guessing.`;

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  // Lazy so importing this module doesn't require the key (e.g. in tests/build).
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

/** Trim, drop empties, dedupe case-insensitively while preserving first-seen order. */
function cleanArtists(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of raw) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
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
              items: { type: "string" },
              description: "Every artist exactly as written, in poster order.",
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
