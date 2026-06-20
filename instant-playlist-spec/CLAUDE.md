# instant.playlist

> Drop a festival poster → hear every artist back to back.

Copy this file to the **root of the new repo**. The full spec lives in `docs/spec/`.

## What this is
A single-purpose, mobile-first PWA. Drop a festival poster → a vision model reads every
artist → each is resolved to a SoundCloud set → you get one continuous, playable, **locally
saved** lineup. No accounts, no payments, no marketplace. One input, one output.

## Stack
Next.js 15 (App Router) · React 19 · TypeScript (strict) · `@anthropic-ai/sdk` (vision) ·
SoundCloud internal API + Widget API · `node:sqlite` local file · `motion` · PWA · Fly.io.

## Commands
- `npm run dev` — dev server on **:3001**
- `npm run build` / `npm run start`
- `npm run lint`

## Environment (server-side only; never expose to the client)
```
ANTHROPIC_API_KEY=         # vision
SOUNDCLOUD_CLIENT_ID=      # SoundCloud internal API
SOUNDCLOUD_OAUTH_TOKEN=    # "2-..." or "OAuth 2-..."
DB_PATH=./data/playlists.db   # optional; persistent volume in prod
SET_MIN_DURATION_MIN=20       # optional; "set vs single" threshold
```

## Conventions (see docs/spec/CODE_GUIDELINES.md)
- Pure logic in `lib/`; side effects (network/fs/db) confined to their module.
- **Resolvers never throw** — a missing artist returns an empty, non-playable `Artist`.
- Route handlers return `{ error }` JSON with proper status codes; no stack leaks.
- Server Components by default; `"use client"` only for the dropzone, lineup rows, player.
- The player is mounted **once** in the root layout and survives navigation.
- Bound concurrency (~3) on any SoundCloud fan-out.
- Comment the **why**, in English.

## Design (see docs/spec/DESIGN.md)
Light/paper, monospace, calm. Tokens: `--paper #ECEAE0`, `--surface #FBFAF5`,
`--ink #1B1B18`, `--muted #8E8C82`, `--green #1F4D2E`, `--orange #E0531F`, `--border #DAD7CC`.
Wordmark: `instant`(green)`.`(orange)`playlist`(green), monospace.
**Do NOT** use the dark purple/Deezer theme or an Archivo Black wordmark — that's a later,
abandoned iteration.

## Working with Claude (the model)
This app uses **Claude vision** for poster reading. Before editing `lib/anthropic.ts`,
consult the **claude-api** skill to confirm the current model id, vision input format, and
tool-use shape — don't hardcode model details from memory. Default to the latest Opus model.

## Build order
Follow `docs/spec/BUILD_PLAN.md` (M0 → M7). Verify each milestone by actually running it.
