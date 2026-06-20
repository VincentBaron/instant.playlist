# ARCHITECTURE

## Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15** (App Router) | RSC by default; route handlers for the API |
| UI | **React 19** + TypeScript 5.7 | strict mode |
| Vision | **`@anthropic-ai/sdk`** | poster → artist names (forced tool call) |
| Audio source | **SoundCloud internal API** (`api-v2.soundcloud.com`) + Widget API | resolve + playback |
| Storage | **`node:sqlite`** (`DatabaseSync`) | single local file; zero external DB |
| Motion | **`motion`** | subtle transitions only |
| Packaging | **PWA** | manifest + service worker |
| Deploy | **Fly.io** | persistent volume for the SQLite file |

> **Node version:** `node:sqlite` requires a recent Node (≥ 22.5 with the experimental flag,
> stable on ≥ 24). Pin the runtime in `.nvmrc`/`engines`. If the target runtime can't provide
> it, swap to `better-sqlite3` — the `lib/db.ts` interface below stays identical.

> **Claude model:** use the current Opus model id (`claude-opus-4-8` at time of writing).
> Before building the vision module, consult the **claude-api** skill to confirm the latest
> model id, vision input format, and tool-use shape — don't hardcode from memory.

## Source layout

```
app/
  layout.tsx                 # root layout; mounts <PlayerProvider> once
  page.tsx                   # landing: dropzone (client component)
  lineup/page.tsx            # lineup screen (or render in-place after scan)
  manifest.ts                # PWA manifest
  api/
    playlist/route.ts        # POST: image|artists -> resolve -> save -> PlaylistRecord
    playlists/route.ts       # GET: list saved playlists
    playlists/[id]/route.ts  # GET one / DELETE one
components/
  Dropzone.tsx               # the poster drop target + HEIC handling
  LineupView.tsx             # grouped, playable lineup list
  player/PlayerProvider.tsx  # global SoundCloud widget + context + bottom bar
lib/
  anthropic.ts               # extractArtists(image) -> { festival, artists[] }
  soundcloud.ts              # search user, latest set, top tracks
  resolve.ts                 # resolveArtists(names[]) -> Artist[] (bounded concurrency)
  db.ts                      # SQLite: savePlaylist / list / get / delete
types.ts                     # shared types (Set, Artist, ...)
public/
  sw.js                      # service worker
data/                        # SQLite file lives here (gitignored)
```

## Data model

```ts
// types.ts
export type Set = {
  title: string;
  url: string;          // SoundCloud permalink (drives the widget + the external link)
  durationMin: number;  // rounded minutes
  artworkUrl: string | null;
};

export type Artist = {
  name: string;             // as read off the poster
  profileUrl: string | null;// SoundCloud profile (null if not found)
  username: string | null;  // exact SoundCloud account name
  set: Set | null;          // latest long set (null if none)
  topTracks: Set[];         // fallback: top tracks when there's no long set
};
```

### SQLite (`lib/db.ts`)

One table is enough for the MVP. (Drop the old `festivals`/intelligence tables — that was the
later expansion.)

```sql
CREATE TABLE IF NOT EXISTS playlists (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT    NOT NULL,
  created_at     TEXT    NOT NULL,   -- ISO string
  artist_count   INTEGER NOT NULL,
  playable_count INTEGER NOT NULL,
  artists        TEXT    NOT NULL    -- JSON.stringify(Artist[])
);
```

Module interface to implement:
```ts
savePlaylist(artists: Artist[], opts?: { title?: string; createdAt?: string }): PlaylistRecord
listPlaylists(): PlaylistSummary[]        // newest first, no artists blob
getPlaylist(id: number): PlaylistRecord | null
deletePlaylist(id: number): boolean
```
- `playableCount` = sum over artists of `set ? 1 : topTracks.length`.
- `title` defaults to a derived label from the first ~3 artist names (or the festival name
  from the vision step when present).
- Open the DB lazily (singleton), `mkdir -p` the parent dir, `CREATE TABLE IF NOT EXISTS` on
  first use. Path from `DB_PATH` env, default `./data/playlists.db`.

## API contracts

### `POST /api/playlist`
Generate, resolve, and save a lineup. `runtime = "nodejs"`, `maxDuration = 300`.

Request (one of):
```jsonc
{ "image": "<base64>", "mediaType": "image/jpeg", "title": "optional" }
// or, for a dev/manual path:
{ "artists": ["kida", "juju", "recto/verso"], "title": "optional" }
```
Response `200`:
```jsonc
{
  "playlist": {
    "id": 12, "title": "kida, juju, recto/verso +25",
    "createdAt": "2026-…", "artistCount": 28, "playableCount": 27,
    "artists": [ /* Artist[] */ ]
  }
}
```
Errors: `400` invalid body / unsupported media type; `500` with `{ "error": message }`.

Optional **streaming** variant (`{ "stream": true }`): emit NDJSON progress lines
(`{type:"step",phase,message}`) ending with the final record, to drive the "reading… /
N/M resolved" status text. Keep this optional — the synchronous form is the baseline.

### `GET /api/playlists`
`200 → { playlists: PlaylistSummary[] }` (newest first).

### `GET /api/playlists/[id]` → `{ playlist: PlaylistRecord }` or `404`.
### `DELETE /api/playlists/[id]` → `{ ok: true }` or `404`.

## The four core modules

### 1. Vision — `lib/anthropic.ts`
`extractArtists(imageBase64, mediaType) -> { festival: string|null, artists: string[] }`
- Single message: an `image` block + a text prompt, with a **forced tool call**
  (`tool_choice: { type: "tool", name: "submit_artists" }`) whose schema is
  `{ festival?: string, artists: string[] }` — guarantees structured JSON out.
- Prompt rules that matter: list every artist exactly as written; identify the festival
  name (blank if unsure); exclude days/dates/stage names/sponsors; split true B2B/collab
  billings (`b2b`, `&`, `x`, `vs`, `+`, `×`) into separate artists **only** when they're
  clearly distinct acts; invent nothing.
- Dedupe case-insensitively, preserve poster order.
- Supported media: `image/png | image/jpeg | image/webp | image/gif`.

### 2. SoundCloud — `lib/soundcloud.ts`
Uses the internal `api-v2.soundcloud.com` with browser-like headers + auth.
- `searchArtist(name)` → first user hit; tries the raw name, then a variant with
  `(...)`/`[...]` annotations stripped.
- `getLatestSet(userId, minDurationMs, maxPages=3)` → newest track whose duration ≥ threshold
  (a *set*, not a single), paging via `linked_partitioning`/`next_href`.
- `getTopTracks(userId, limit=3)` → fallback, sorted by `playback_count`.
- Map a raw track → `Set` (`full_duration ?? duration`, rounded to minutes).

### 3. Resolution — `lib/resolve.ts`
- `resolveArtist(name)` → never throws: returns an empty (non-playable) `Artist` on any
  miss/error. Tries an optional pinned-overrides map first, then search → latest set →
  (if none) top tracks.
- `resolveArtists(names, { concurrency = 3 })` → bounded parallel map (`mapWithConcurrency`)
  to stay polite to SoundCloud.
- `minDurationMs()` from `SET_MIN_DURATION_MIN` env (default 20 min).

### 4. Player — `components/player/PlayerProvider.tsx`
- Mounted **once** in the root layout; a hidden SoundCloud Widget `<iframe>` survives client
  navigation so audio never stops.
- Loads `https://w.soundcloud.com/player/api.js`; controls the widget via `load/play/toggle/seekTo`.
- Context API: `playQueue(id, title, items, startIndex)`, `toggle`, `next`, `prev`, plus
  `queueId`/`index`/`isPlaying` so a view can highlight its active row.
- `QueueItem = { url, title, artist, durationMin, artworkUrl }`.
- On track `FINISH`, auto-advance to the next queue item; stop at the end.
- `LineupView` builds a queue from `Artist[]` (each `set`, else each `topTrack`) and pushes it
  to the player; it does not own playback state.
- The bar hides on the landing route but the iframe stays mounted.

## Environment variables

```bash
ANTHROPIC_API_KEY=sk-ant-...        # vision (server only)
SOUNDCLOUD_CLIENT_ID=...            # SoundCloud internal API
SOUNDCLOUD_OAUTH_TOKEN=...          # "2-..." or "OAuth 2-..."
DB_PATH=./data/playlists.db         # optional; point at a volume in prod
SET_MIN_DURATION_MIN=20             # optional; "set vs single" threshold
```
All secrets are **server-side only**. Vision and SoundCloud resolution happen in route
handlers / server modules; the client only ever talks to `/api/*` and the public SC widget.

> SoundCloud's internal API is unofficial: the client id / OAuth token can expire and need
> refreshing. Isolate all of it in `lib/soundcloud.ts` and fail with clear error messages.

## PWA & deploy

- `app/manifest.ts` (name, theme color = `--paper`, icons) + a small service worker:
  network-first for navigations (so deploys are picked up), cache-first for same-origin
  static assets, never intercept `/api/*` or cross-origin (SoundCloud).
- Deploy to Fly.io with a **persistent volume** mounted where `DB_PATH` points, so saved
  lineups survive restarts.
