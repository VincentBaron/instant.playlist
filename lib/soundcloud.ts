import type { Track } from "@/types";
import { inferBpm } from "@/lib/bpm";
import { inferGenre } from "@/lib/genre";

/*
 * SoundCloud's INTERNAL api-v2 (unofficial — official API access is pending). All of
 * it is isolated in this module so that swapping to the official API later is contained.
 * Client id + OAuth token can expire and need refreshing; failures throw here and are
 * absorbed by lib/resolve.ts (resolvers never throw).
 *
 * Server-side only — reads SOUNDCLOUD_CLIENT_ID / SOUNDCLOUD_OAUTH_TOKEN.
 */
const BASE = "https://api-v2.soundcloud.com";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3; // one initial try + two retries
const RETRY_BASE_DELAY_MS = 300;

// Transient upstream statuses worth retrying — rate-limit and gateway/5xx blips. A wide
// SoundCloud fan-out hits these under concurrency; a single miss must not permanently bake
// a real artist into a lineup as "not found" (the bug behind YOL-37).
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

class RetryableError extends Error {}
class NonRetryableError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Minimal shapes for the fields we actually read off the raw JSON.
interface SCRawUser {
  id: number;
  username?: string;
  permalink_url?: string;
  kind?: string;
  followers_count?: number; // popularity — breaks ties between same-named accounts
  track_count?: number;
}
interface SCRawTrack {
  id: number;
  title?: string;
  permalink_url?: string;
  duration?: number; // ms (often a snippet)
  full_duration?: number; // ms (the real length)
  artwork_url?: string | null;
  playback_count?: number;
  bpm?: number | null; // rarely set by uploaders
  genre?: string | null; // single genre label
  tag_list?: string | null; // space-separated tags (the usual tempo signal)
}
interface SCPage<T> {
  collection?: T[];
  next_href?: string;
}

export interface SCUser {
  id: number;
  username: string;
  permalinkUrl: string;
  followersCount: number; // 0 when unknown; used only as a tie-breaker in candidate scoring
  trackCount: number;
}

/** OAuth token may be stored as "2-..." or already prefixed "OAuth 2-...". */
function authHeader(): Record<string, string> {
  const token = process.env.SOUNDCLOUD_OAUTH_TOKEN?.trim();
  if (!token) return {};
  return {
    Authorization: /^oauth\s/i.test(token) ? token : `OAuth ${token}`,
  };
}

/** One HTTP attempt. Throws RetryableError for transient failures, plain Error otherwise. */
async function scGetOnce(url: URL): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        // Browser-like UA — the internal API is picky about anonymous clients.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        ...authHeader(),
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      const msg = `soundcloud ${res.status} for ${url.pathname}`;
      throw RETRYABLE_STATUS.has(res.status)
        ? new RetryableError(msg)
        : new NonRetryableError(msg);
    }
    return await res.json();
  } catch (err) {
    // Our own classified errors pass through; anything else (network TypeError, timeout
    // AbortError, JSON parse) is a transient blip worth a retry.
    if (err instanceof RetryableError || err instanceof NonRetryableError) throw err;
    throw new RetryableError(err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET a full api-v2 URL as JSON. Ensures client_id is present (next_href omits it) and
 * retries transient failures (429/5xx/timeout) with linear back-off — resolvers upstream
 * absorb the final throw, so a bad blip degrades to an empty Artist only after real retries.
 */
async function scGet(rawUrl: string): Promise<unknown> {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  if (!clientId) throw new Error("SOUNDCLOUD_CLIENT_ID is not set");

  const url = new URL(rawUrl);
  if (!url.searchParams.has("client_id"))
    url.searchParams.set("client_id", clientId);

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await scGetOnce(url);
    } catch (err) {
      lastErr = err;
      if (!(err instanceof RetryableError) || attempt === MAX_ATTEMPTS) throw err;
      await sleep(RETRY_BASE_DELAY_MS * attempt);
    }
  }
  throw lastErr; // unreachable, keeps the type-checker happy
}

function scApi(
  path: string,
  params: Record<string, string | number> = {},
): Promise<unknown> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  return scGet(url.toString());
}

function toUser(raw: SCRawUser): SCUser | null {
  if (!raw?.id || !raw.permalink_url) return null;
  return {
    id: raw.id,
    username: raw.username ?? "",
    permalinkUrl: raw.permalink_url,
    followersCount: raw.followers_count ?? 0,
    trackCount: raw.track_count ?? 0,
  };
}

function toTrack(raw: SCRawTrack): Track {
  // full_duration is the real length; duration is often just the free snippet.
  const ms = raw.full_duration ?? raw.duration ?? 0;
  return {
    title: typeof raw.title === "string" ? raw.title : "",
    url: raw.permalink_url ?? "",
    durationMin: Math.max(0, Math.round(ms / 60_000)),
    artworkUrl: typeof raw.artwork_url === "string" ? raw.artwork_url : null,
    bpm: inferBpm({ bpm: raw.bpm, genre: raw.genre, tagList: raw.tag_list }),
    genre: inferGenre({ genre: raw.genre, tagList: raw.tag_list }),
  };
}

async function searchUsers(q: string, limit: number): Promise<SCUser[]> {
  const data = (await scApi("/search/users", { q, limit })) as SCPage<SCRawUser>;
  return (data.collection ?? []).map(toUser).filter((u): u is SCUser => u !== null);
}

/** Drop bracketed annotations: "Artist (live)" / "Artist [b2b X]" → "Artist". */
function stripAnnotations(name: string): string {
  return name
    .replace(/[([{][^)\]}]*[)\]}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Candidate accounts for a poster name — several hits, not just the top one, so the
 * caller (lib/match.ts) can pick the account that actually matches the name instead of
 * trusting SoundCloud's relevance blindly. Searches the raw name and, if different, a
 * bracket-stripped variant, then de-dupes by account id.
 */
export async function searchArtistCandidates(
  name: string,
  limit = 8,
): Promise<SCUser[]> {
  const queries = [name];
  const stripped = stripAnnotations(name);
  if (stripped && stripped.toLowerCase() !== name.toLowerCase()) queries.push(stripped);

  const byId = new Map<number, SCUser>();
  for (const q of queries) {
    for (const user of await searchUsers(q, limit)) {
      if (!byId.has(user.id)) byId.set(user.id, user);
    }
  }
  return [...byId.values()];
}

/** Resolve a known SoundCloud profile URL straight to a user (for pinned overrides). */
export async function resolveUser(profileUrl: string): Promise<SCUser | null> {
  const data = (await scApi("/resolve", { url: profileUrl })) as SCRawUser;
  return data?.kind === "user" ? toUser(data) : null;
}

/**
 * Newest track whose real duration ≥ threshold — i.e. a DJ *set*, not a single.
 * The tracks endpoint returns newest-first, so we page newest→older and take the
 * first one over the line.
 */
export async function getLatestSet(
  userId: number,
  minDurationMs: number,
  maxPages = 3,
): Promise<Track | null> {
  let url: string | undefined =
    `${BASE}/users/${userId}/tracks?limit=50&linked_partitioning=1`;
  for (let page = 0; page < maxPages && url; page++) {
    const data = (await scGet(url)) as SCPage<SCRawTrack>;
    for (const raw of data.collection ?? []) {
      const ms = raw.full_duration ?? raw.duration ?? 0;
      if (ms >= minDurationMs) return toTrack(raw);
    }
    url = data.next_href;
  }
  return null;
}

/** Fallback when there's no long set: the most-played tracks, by playback count. */
export async function getTopTracks(
  userId: number,
  limit = 3,
): Promise<Track[]> {
  const data = (await scApi(`/users/${userId}/tracks`, {
    limit: 50,
    linked_partitioning: 1,
  })) as SCPage<SCRawTrack>;
  return (data.collection ?? [])
    .slice()
    .sort((a, b) => (b.playback_count ?? 0) - (a.playback_count ?? 0))
    .slice(0, limit)
    .map(toTrack);
}
