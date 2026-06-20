# CODE GUIDELINES

Distilled from the working implementation. The goal is small, honest, boring code: pure
logic in `lib/`, side effects at the edges, and a UI that's mostly type and whitespace.

## TypeScript

- `strict: true`. No `any` except at unavoidable third-party seams (e.g. the SoundCloud
  Widget global) — and isolate those behind a typed wrapper.
- Export explicit types at module boundaries (`Artist`, `Set`, `PlaylistRecord`, `QueueItem`).
  Keep shared shapes in `types.ts`.
- Prefer `type` aliases over `interface` for data shapes (matches the existing code).
- Use `import type { … }` for type-only imports.

## Functions & modules

- Functional only — no classes (the DB singleton is a module-level `let`, not a class).
- `lib/` functions are pure where possible. Side effects (network, fs, db) are named clearly
  and confined to their own module.
- One responsibility per module: vision in `anthropic.ts`, SoundCloud HTTP in `soundcloud.ts`,
  resolution policy in `resolve.ts`, persistence in `db.ts`.
- Bound concurrency for any fan-out over an external API (`mapWithConcurrency`, limit ~3).

## Error handling

- **Resolvers never throw.** A missing/blocked artist returns an empty, non-playable `Artist`
  so one bad name can't sink a whole lineup.
- **Route handlers** catch and return `NextResponse.json({ error }, { status })` — `400` for
  bad input, `500` for unexpected failures. Never leak a stack to the client.
- **Env access** throws a clear, specific message at point of use (`"SOUNDCLOUD_CLIENT_ID
  manquant"` → in the new repo, English: `"Missing SOUNDCLOUD_CLIENT_ID"`).

## React / Next

- Server Components by default. Add `"use client"` only for interactivity (dropzone, lineup
  rows, player).
- The player is mounted **once** in the root layout and exposed via context; views push a
  queue, they don't own playback.
- Keep network calls server-side. The client talks to `/api/*` and the public SoundCloud
  widget only — never to Anthropic or the SoundCloud internal API directly.
- Route handlers that do vision + dozens of lookups set `runtime = "nodejs"` and a generous
  `maxDuration`.

## Styling

- Plain CSS with custom properties (the tokens in `DESIGN.md`) in a single `globals.css`,
  or CSS modules. No heavy UI framework. Match the existing class-based, semantic approach
  (`.row`, `.player`, `.wordmark`).
- Mobile-first. One column, centered, max-width ~640px.
- Respect `prefers-reduced-motion`.

## Comments

- Comment **why**, not what. The original is heavily commented at decision points (why a
  threshold exists, why the widget bootstraps once, why resolvers swallow errors). Keep that
  habit. Write comments in **English** in the new repo.

## Naming

- `camelCase` functions/values, `PascalCase` components/types, `SCREAMING_SNAKE` for env keys.
- Files: components `PascalCase.tsx`, libs `kebab`/`lowercase.ts`, routes per Next conventions.

## Git & process

- Conventional, present-tense commit subjects. Commit per milestone (see `BUILD_PLAN.md`).
- `.gitignore`: `node_modules`, `.next`, `.env*`, `data/` (the SQLite file).
- Never commit secrets or the local DB. Provide `.env.example` with empty keys.
- `engines.node` / `.nvmrc` pinned to a version that supports `node:sqlite`.

## Definition of done (per feature)

- Types exported and used; no `any` leaks.
- Failure path handled (empty artist, bad upload, expired token) without crashing the flow.
- Verified by actually running it (see each milestone's verification), not just by compiling.
