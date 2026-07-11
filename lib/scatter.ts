import type { LineupSummary } from "@/types";

/*
 * Pure poster-scatter geometry. Festival names get positioned around the home page
 * like acts on a lineup poster. Positions are DETERMINISTIC (seeded from each slug) so
 * server render and client hydration produce identical coordinates — no Math.random(),
 * no hydration mismatch, stable across refreshes. No side effects.
 */

export type ScatterTier = 0 | 1 | 2 | 3; // 0 = smallest/greyed (nothing playable), 3 = headliner

export type ScatterPlacement = {
  lineup: LineupSummary;
  topPct: number; // vertical position, %
  leftPct: number; // horizontal position, %
  rotate: number; // slight poster tilt, degrees
  tier: ScatterTier;
};

/** Small deterministic string hash (FNV-1a). Stable, fast, no dependencies. */
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Seeded pseudo-random in [0,1) from a base seed + salt — independent axes per name. */
function rand(seed: number, salt: string): number {
  return hash(`${seed}:${salt}`) / 0x100000000;
}

/** Size tier from how much of the lineup actually plays (headliner feel). 0 = greyed. */
function tierFor(playableCount: number): ScatterTier {
  if (playableCount <= 0) return 0;
  if (playableCount >= 12) return 3;
  if (playableCount >= 6) return 2;
  return 1;
}

// Horizontal bias: keep names in the left/right margins so they FRAME the centered
// headline + CTA rather than cover it. Two bands, left and right of a center safe-zone.
const LEFT_BAND = { min: 2, max: 27 };
const RIGHT_BAND = { min: 61, max: 88 };
const TOP_MIN = 4;
const TOP_MAX = 90;
const MAX_TILT = 8; // degrees

/** Deterministically place every festival around the poster. Input order is preserved. */
export function scatterPlacements(lineups: LineupSummary[]): ScatterPlacement[] {
  const n = Math.max(lineups.length, 1);
  // Vertical position is spread by index (evenly-spaced rows) + seeded jitter — this keeps
  // names from stacking on top of each other when there are only a handful (pure per-slug
  // randomness clusters badly at small N). Horizontal side/offset and tilt stay seeded, so
  // the result still reads as an organic scatter rather than two tidy columns.
  const rowSpan = (TOP_MAX - TOP_MIN) / n;
  return lineups.map((lineup, i) => {
    const seed = hash(lineup.slug);
    const band = rand(seed, "side") < 0.5 ? LEFT_BAND : RIGHT_BAND;
    const leftPct = band.min + rand(seed, "x") * (band.max - band.min);
    // Center of this index's row, jittered within ±40% of the row height.
    const rowCenter = TOP_MIN + (i + 0.5) * rowSpan;
    const jitter = (rand(seed, "y") - 0.5) * rowSpan * 0.8;
    const topPct = Math.min(TOP_MAX, Math.max(TOP_MIN, rowCenter + jitter));
    const rotate = (rand(seed, "rot") * 2 - 1) * MAX_TILT;
    return {
      lineup,
      topPct,
      leftPct,
      rotate,
      tier: tierFor(lineup.playableCount),
    };
  });
}

/** Font size per tier, fluid via clamp() so it scales on mobile (mobile-first). */
export function fontSizeForTier(tier: ScatterTier): string {
  switch (tier) {
    case 3:
      return "clamp(1.5rem, 5vw, 3rem)";
    case 2:
      return "clamp(1.25rem, 4vw, 2.25rem)";
    case 1:
      return "clamp(1rem, 3vw, 1.6rem)";
    case 0:
    default:
      return "clamp(0.85rem, 2.4vw, 1.15rem)";
  }
}
