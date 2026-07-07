import {
  MIN_NAME_SCORE,
  normalizeName,
  pickBestCandidate,
  scoreCandidate,
  slugOf,
} from "@/lib/match";
import type { SCUser } from "@/lib/soundcloud";

/*
 * Deterministic, no-network checks for the pure candidate scorer (lib/match.ts) — the
 * core of the YOL-37 fix. Runs offline so it's fast and CI-safe.
 */

function user(username: string, slug: string, followers = 0): SCUser {
  return {
    id: Math.abs(hash(slug)),
    username,
    permalinkUrl: `https://soundcloud.com/${slug}`,
    followersCount: followers,
    trackCount: 0,
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

let failures = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) failures++;
}

// --- normalization -------------------------------------------------------------
check("normalizeName strips diacritics + punctuation", normalizeName("Voltéry!") === "voltery");
check("slugOf extracts the handle", slugOf("https://soundcloud.com/voltery") === "voltery");

// --- exact handle beats a more-followed namesake -------------------------------
{
  const voltery = user("Voltery", "voltery", 1_200);
  const namesake = user("Voltery Official Fan", "voltery-fanpage", 50_000);
  const pick = pickBestCandidate("Voltery", [namesake, voltery]);
  check("exact handle wins over a bigger namesake", pick.user?.id === voltery.id);
  check("exact match scores ~1", scoreCandidate("Voltery", voltery) > 0.99);
}

// --- weak matches are refused (return null, not a wrong guess) ------------------
{
  const unrelated = user("Completely Different DJ", "some-other-act", 9_000);
  const pick = pickBestCandidate("Voltery", [unrelated]);
  check("no plausible match → null (refuse a wrong guess)", pick.user === null);
  check("weak score is below MIN_NAME_SCORE", scoreCandidate("Voltery", unrelated) < MIN_NAME_SCORE);
}

// --- close typo still matches --------------------------------------------------
{
  const near = user("Voltrey", "voltrey", 500);
  const pick = pickBestCandidate("Voltery", [near]);
  check("one-char difference still resolves", pick.user?.id === near.id);
}

// --- ambiguity flagged for two equally-good same-named accounts ----------------
{
  const a = user("Nova", "nova", 2_000);
  const b = user("Nova", "nova-music", 2_100);
  const pick = pickBestCandidate("Nova", [a, b]);
  check("two strong same-name accounts are ambiguous", pick.ambiguous && pick.runnerUp !== null);
}

// --- empty candidate list is safe ----------------------------------------------
check("empty candidate list → null", pickBestCandidate("Anyone", []).user === null);

console.log(`\n${failures === 0 ? "✓ match-verify OK" : `✗ ${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
