import type { Track } from "@/types";

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

// Minimal shapes for the fields we actually read off the raw JSON.
interface SCRawUser {
  id: number;
  username?: string;
  permalink_url?: string;
  kind?: string;
}
interface SCRawTrack {
  id: number;
  title?: string;
  permalink_url?: string;
  duration?: number; // ms (often a snippet)
  full_duration?: number; // ms (the real length)
  artwork_url?: string | null;
  playback_count?: number;
}
interface SCPage<T> {
  collection?: T[];
  next_href?: string;
}

export interface SCUser {
  id: number;
  username: string;
  permalinkUrl: string;
}

/** OAuth token may be stored as "2-..." or already prefixed "OAuth 2-...". */
function authHeader(): Record<string, string> {
  const token = process.env.SOUNDCLOUD_OAUTH_TOKEN?.trim();
  if (!token) return {};
  return {
    Authorization: /^oauth\s/i.test(token) ? token : `OAuth ${token}`,
  };
}

/** GET a full api-v2 URL as JSON. Ensures client_id is present (next_href omits it). */
async function scGet(rawUrl: string): Promise<unknown> {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  if (!clientId) throw new Error("SOUNDCLOUD_CLIENT_ID is not set");

  const url = new URL(rawUrl);
  if (!url.searchParams.has("client_id"))
    url.searchParams.set("client_id", clientId);

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
    if (!res.ok) throw new Error(`soundcloud ${res.status} for ${url.pathname}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
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
  };
}

async function searchUsers(q: string): Promise<SCUser | null> {
  const data = (await scApi("/search/users", { q, limit: 1 })) as SCPage<SCRawUser>;
  const first = data.collection?.[0];
  return first ? toUser(first) : null;
}

/**
 * First user hit for a name. Tries the raw name, then a variant with bracketed
 * annotations stripped (e.g. "Artist (live)" → "Artist").
 */
export async function searchArtist(name: string): Promise<SCUser | null> {
  const direct = await searchUsers(name);
  if (direct) return direct;

  const stripped = name
    .replace(/[([{][^)\]}]*[)\]}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped && stripped.toLowerCase() !== name.toLowerCase()) {
    return searchUsers(stripped);
  }
  return null;
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
