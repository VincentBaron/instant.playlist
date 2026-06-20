# BUILD PLAN

Work top to bottom. Each milestone ends with a concrete way to **see it work** — verify
before moving on. Commit at each milestone.

## M0 — Scaffold
- `create-next-app` (App Router, TS). Add `@anthropic-ai/sdk`, `motion`.
- Pin Node (`.nvmrc` / `engines`) to a version supporting `node:sqlite`.
- Add `types.ts` (`Set`, `Artist`), `.env.example`, `.gitignore` (`data/`, `.env*`, `.next`).
- Drop the design tokens into `globals.css`; load the monospace font.
- **Verify:** `npm run dev` serves a blank styled page on the paper background.

## M1 — Persistence (`lib/db.ts`)
- Implement the singleton SQLite open, the `playlists` table, and
  `savePlaylist / listPlaylists / getPlaylist / deletePlaylist`.
- **Verify:** a throwaway script (or a temporary route) saves a hand-built `Artist[]` and
  lists it back; a `data/playlists.db` file appears.

## M2 — Vision (`lib/anthropic.ts`)
- Consult the **claude-api** skill for the current model id + vision/tool-use shape.
- Implement `extractArtists` with the forced `submit_artists` tool call; dedupe + order.
- **Verify:** feed a real festival poster (base64) and log the extracted names + festival.

## M3 — SoundCloud + resolution (`lib/soundcloud.ts`, `lib/resolve.ts`)
- `searchArtist`, `getLatestSet`, `getTopTracks`; then `resolveArtist` / `resolveArtists`
  (bounded concurrency, never throws, optional overrides, `SET_MIN_DURATION_MIN`).
- **Verify:** resolve a small name list; confirm each gets a profile + a playable `Set` or
  top tracks, and that an unknown name returns a non-playable `Artist` without throwing.

## M4 — The pipeline endpoint (`POST /api/playlist`)
- Wire vision → resolve → `savePlaylist`. Support `{ image, mediaType }` and `{ artists }`.
  Validate media type; `runtime="nodejs"`, `maxDuration=300`. Add `GET /api/playlists` +
  `[id]` get/delete.
- **Verify:** `curl` a base64 poster to `/api/playlist`; get back a saved `PlaylistRecord`;
  see it in `GET /api/playlists`.

## M5 — Landing dropzone (`app/page.tsx`, `components/Dropzone.tsx`)
- Build the dropzone screen per `DESIGN.md`: wordmark, tagline, the single drop/browse card.
- Read the file → (convert HEIC→JPEG client-side, e.g. `heic2any`) → base64 → POST. Enforce
  ~8 MB max. Show quiet status text while reading/resolving.
- On success, route to the lineup with the returned playlist.
- **Verify:** drop a poster on mobile + desktop; HEIC works; the lineup appears.

## M6 — Lineup + player (`components/LineupView.tsx`, `player/PlayerProvider.tsx`)
- `LineupView`: group tracks by artist, render rows (playable / not-found / active), push a
  queue to the player, highlight the active row.
- `PlayerProvider`: mount once in `layout.tsx`; SoundCloud Widget bootstrap; `playQueue`,
  `toggle`, `next`, `prev`, `seek`, auto-advance on finish; the sticky bottom bar.
- **Verify:** tap a row → it plays and auto-advances through the lineup; the bar persists
  across navigation; prev/next/seek work; the active row highlights.

## M7 — PWA + deploy (optional, ship it)
- `app/manifest.ts` + `public/sw.js` (network-first navigations, cache-first assets, skip
  `/api/*` and cross-origin). Icons.
- Deploy to Fly.io with a persistent volume mounted at `DB_PATH`.
- **Verify:** installable PWA; saved lineups survive a redeploy/restart.

## End-to-end acceptance
Drop a recognizable poster → within a minute, a playable lineup renders, plays back to back,
and is listed on a return visit. ≥ ~80% of legible names resolve to audio.
