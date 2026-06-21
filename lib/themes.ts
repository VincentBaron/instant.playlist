/*
 * The palette a "pattern" is composed from. A pattern = one curated dark BACKGROUND
 * (gradient pair) + one bright ACCENT + a grain amount. Because both come from curated,
 * legible-by-design swatches, every posted pattern stays readable AND abuse-proof (you
 * can only pick colors, never type or draw) — that's what lets the whole community
 * voting loop run with no auth and no moderation.
 *
 * Pure data + helpers, no side effects. Shared by the client composer and the server
 * sanitizer (the server re-checks every submission against these whitelists).
 */
export type Pattern = {
  from: string; // gradient start (top)
  to: string; // gradient end (bottom)
  accent: string; // overrides --acid within the lineup
  grain: number; // 0..MAX_GRAIN
};

// Curated dark backgrounds (gradient pairs) — all dark so paper-on-dark type stays legible.
export const BACKGROUNDS: { id: string; from: string; to: string }[] = [
  { id: "ink", from: "#15120D", to: "#1B1712" },
  { id: "ember", from: "#1F0E08", to: "#2E1206" },
  { id: "uv", from: "#160C26", to: "#2A1448" },
  { id: "deepsea", from: "#061417", to: "#0A2A2E" },
  { id: "magenta", from: "#1C0717", to: "#2E0B2A" },
  { id: "forest", from: "#0A140C", to: "#122A16" },
  { id: "cobalt", from: "#0A0F26", to: "#14224A" },
  { id: "mono", from: "#121212", to: "#1E1E1E" },
];

// Curated bright accents — each pops on every background above.
export const ACCENTS: string[] = [
  "#CBFF3C", // acid (house)
  "#FF7A3C", // ember
  "#B98CFF", // ultraviolet
  "#4EC8C0", // teal
  "#FF6FB5", // pink
  "#8CE06A", // green
  "#6E9BFF", // blue
  "#EDE6D6", // paper
];

export const DEFAULT_GRAIN = 0.09;
export const MAX_GRAIN = 0.28;

/** The house look, used when a lineup has no posted patterns yet. */
export const HOUSE_PATTERN: Pattern = {
  from: BACKGROUNDS[0].from,
  to: BACKGROUNDS[0].to,
  accent: ACCENTS[0],
  grain: DEFAULT_GRAIN,
};

export function clampGrain(g: number): number {
  if (!Number.isFinite(g)) return DEFAULT_GRAIN;
  return Math.min(MAX_GRAIN, Math.max(0, g));
}

/**
 * Server-side guardrail: accept a submission ONLY if its colors are exactly from the
 * curated whitelists (a background pair + an accent). Returns a clean Pattern or null.
 * This is what keeps posted patterns legible and impossible to abuse.
 */
export function sanitizePattern(input: {
  from?: unknown;
  to?: unknown;
  accent?: unknown;
  grain?: unknown;
}): Pattern | null {
  const bg = BACKGROUNDS.find((b) => b.from === input.from && b.to === input.to);
  const accent =
    typeof input.accent === "string" && ACCENTS.includes(input.accent)
      ? input.accent
      : null;
  if (!bg || !accent) return null;
  const grain = clampGrain(typeof input.grain === "number" ? input.grain : DEFAULT_GRAIN);
  return { from: bg.from, to: bg.to, accent, grain };
}
