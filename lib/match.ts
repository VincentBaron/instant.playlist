import type { SCUser } from "@/lib/soundcloud";

/*
 * Pure candidate scoring for artist resolution — no I/O, fully unit-testable.
 *
 * The problem this solves: SoundCloud's /search/users returns results by its own
 * relevance, and blindly taking the top hit picks a wrong namesake (or nothing) for
 * short/ambiguous handles. Here we score every candidate against the poster name so we
 * can (a) pick the real account and (b) refuse a weak guess rather than grey out a
 * real artist by matching the wrong one.
 */

/** Minimum name score to accept a candidate at all — below this we treat it as "not found". */
export const MIN_NAME_SCORE = 0.55;

/** Two top candidates within this score margin are "ambiguous" — genre coherence breaks the tie. */
export const AMBIGUOUS_MARGIN = 0.12;

/**
 * Compact a display name / handle to comparable form: lowercase, strip diacritics,
 * drop everything but a–z0–9. "Voltéry (live)" and "voltery" both → "voltery".
 */
export function normalizeName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Last path segment of a SoundCloud profile URL — the account's handle ("voltery"). */
export function slugOf(profileUrl: string): string {
  try {
    const path = new URL(profileUrl).pathname.replace(/^\/+|\/+$/g, "");
    return path.split("/")[0] ?? "";
  } catch {
    return "";
  }
}

/** Levenshtein edit distance between two short strings. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Similarity in [0,1] from edit distance, normalized by the longer string. */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const dist = editDistance(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

/**
 * Score a candidate against the poster name in [0,1]. We compare the query to both the
 * account handle (slug) and its display username and take the best — an artist's handle
 * often matches the poster even when the display name is stylised, and vice-versa.
 */
export function scoreCandidate(query: string, user: SCUser): number {
  const q = normalizeName(query);
  if (!q) return 0;
  const targets = [normalizeName(user.username), normalizeName(slugOf(user.permalinkUrl))];
  return Math.max(0, ...targets.map((t) => similarity(q, t)));
}

export interface CandidatePick {
  /** Best candidate at or above MIN_NAME_SCORE, else null (= treat as not found). */
  user: SCUser | null;
  score: number;
  /** True when the runner-up is within AMBIGUOUS_MARGIN — a genre check should break the tie. */
  ambiguous: boolean;
  /** The runner-up when ambiguous, so the batch resolver can re-check it by genre. */
  runnerUp: SCUser | null;
}

/**
 * Pick the best-matching candidate for a name. Primary signal is name similarity;
 * follower count breaks near-exact ties (the more-followed of two same-named accounts is
 * the likelier target). Returns null when nothing clears the threshold rather than
 * confidently returning a wrong namesake.
 */
export function pickBestCandidate(query: string, candidates: SCUser[]): CandidatePick {
  if (candidates.length === 0) {
    return { user: null, score: 0, ambiguous: false, runnerUp: null };
  }

  const ranked = candidates
    .map((user) => ({ user, score: scoreCandidate(query, user) }))
    .sort((a, b) =>
      b.score !== a.score
        ? b.score - a.score
        : (b.user.followersCount ?? 0) - (a.user.followersCount ?? 0),
    );

  const best = ranked[0];
  if (best.score < MIN_NAME_SCORE) {
    return { user: null, score: best.score, ambiguous: false, runnerUp: null };
  }

  const second = ranked[1];
  const ambiguous =
    !!second && second.score >= MIN_NAME_SCORE && best.score - second.score <= AMBIGUOUS_MARGIN;

  return {
    user: best.user,
    score: best.score,
    ambiguous,
    runnerUp: ambiguous ? second.user : null,
  };
}
