# instant.playlist

> Scan a festival poster → a public, shareable, playable lineup of long DJ sets.

## What this is
A consumer **music-discovery** product disguised as a festival utility. Scan a poster (or a QR on
one) → a beautiful **public, shareable** page that plays the whole lineup's SoundCloud DJ sets
back to back → every scan compounds a crowd-built database of festival sets. Festival = the wedge;
"scan any lineup anywhere" = the habit. Each lineup carries a **QR** (physical-world distribution)
and a **tracked official ticket link** (UTM now → affiliate commission later; the path to B2B with
promoters). Positioning: anti-algorithm, human-curated, physical-world discovery.

Full strategy, MVP cut, flywheel, design system, and build order live in the approved plan:
`~/.claude/plans/i-want-to-start-stateful-finch.md`. The reverse-engineered reference spec is in
`instant-playlist-spec/` (treat as reference, not gospel — see deltas in the plan).

## Stack (foundation decision — see plan)
**Fresh, consolidated Next.js 15 (App Router) single app.** NOT a monorepo. We deliberately
replaced a CTO boilerplate (Express+Kysely+TanStack+observability) that was over-engineered for a
solo MVP. Optimize for **low files-per-feature** — that is the agent-velocity lever.
- Next.js 15 · React 19 · TypeScript (strict) · Tailwind v4 + CSS-variable design tokens
- `@anthropic-ai/sdk` (vision: poster → artist names, forced tool call)
- SoundCloud (resolve + Widget API for playback; official API access pending)
- DB: hosted Postgres (Neon/Supabase) or Turso/libSQL + migrations + generated types
- Logging: pino → stdout. Auth (better-auth): **deferred** until accounts are needed (MVP is anon).

## Conventions
- Pure logic in `lib/`; side effects (network/fs/db) confined to their module. **Resolvers never
  throw** — a missing artist returns an empty, non-playable `Artist`.
- Route handlers return `{ error }` JSON with proper status codes; never leak stacks.
- Server Components by default; `"use client"` only where interactive (dropzone, lineup rows, player).
- The player is mounted **once** in the root layout and survives navigation (audio never stops).
- Bound concurrency (~3) on any SoundCloud fan-out. Comment the **why**, in English.
- Keep typed boundaries (Zod + inferred TS). Few, colocated files per feature. No barrel files.

## Design — "Fly-Poster" (two-ink screenprint). See plan for full tokens.
```css
--paper:#EDE6D6; --ink:#15120D; --acid:#CBFF3C; --ember:#FF4A1C; --muted:#877F70; --line:#D7CFBC;
```
Type: **Archivo** (condensed/black) = the human-curated poster (festival name, artist names);
**Space Mono** = the machine (wordmark, counts, track titles, durations, status). Signature move:
**the lineup IS a playable poster** — name size encodes the set's **BPM** (faster = bigger, unknown
= smallest; see `lib/bpm.ts` + `fontSizeFor` in `components/LineupView.tsx`), every name a live row;
playing name lit `--acid` with an `--ember` pulse; faint riso grain over a dark field. The
public share page is the hero (QR landing + screenshot): instant, gorgeous on mobile, autoplay-on-
tap, NO signup wall. Landing + player stay quiet so the share page hits hardest. Mobile-first;
respect `prefers-reduced-motion`. PWA: ship the web manifest only; **no service worker** for MVP.

## Commands (after scaffold)
- `npm run dev` — dev server on **:3001**
- `npm run build` / `npm run start` / `npm run lint`

## Environment (server-side only unless prefixed NEXT_PUBLIC_)
```
ANTHROPIC_API_KEY=          # vision
SOUNDCLOUD_CLIENT_ID=       # SoundCloud API
SOUNDCLOUD_OAUTH_TOKEN=     # "2-..." or "OAuth 2-..."
DATABASE_URL=               # hosted Postgres / Turso
SET_MIN_DURATION_MIN=20     # optional; "set vs single" threshold
# Auth + credits (YOL-49): gate uploads behind an account; 3 free scans, then buy more.
BETTER_AUTH_SECRET=         # random 32+ char secret
BETTER_AUTH_URL=            # app origin (e.g. http://localhost:3001)
GOOGLE_CLIENT_ID=           # optional; Google one-tap (email OTP works without it)
GOOGLE_CLIENT_SECRET=       # optional
FREE_CREDITS=3              # optional; free scans per account (default 3)
RESEND_API_KEY=             # email OTP delivery (Resend); required in prod for email sign-in
EMAIL_FROM=                 # verified sender for OTP emails, e.g. "instant.playlist <hey@dom>"
NEXT_PUBLIC_BMC_URL=        # Buy Me a Coffee page (paywall link)
NEXT_PUBLIC_PRICE_PER_SCAN_CENTS=50  # optional; flat price of 1 scan (default 50)
BMC_WEBHOOK_SECRET=         # verifies the HMAC on /api/bmc/webhook (auto-grants credits)
```
Paywall = Buy Me a Coffee (no in-app checkout). The webhook matches a supporter's **email**
to their account and grants `floor(amount / price-per-scan)` credits, idempotent on the BMC
payment id. Fallback for unmatched/manual grants: `npm run grant:credits -- <email> <n>`.

## Working with Claude (the model)
This app uses **Claude vision** for poster reading. Before editing the vision module, consult the
**claude-api** skill to confirm the current model id, vision input format, and tool-use shape —
don't hardcode from memory. Default to the latest Opus model.

## Next.js 15 specifics
@AGENTS.md
