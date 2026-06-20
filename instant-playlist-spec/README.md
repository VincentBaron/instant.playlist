# instant.playlist — rebuild spec

> Drop a festival poster → hear every artist back to back.

This bundle is a **deep, self-contained specification** for rebuilding the original
`instant.playlist` MVP in a fresh repository. It is reverse-engineered from the working
implementation (the proven pipeline still exists in the old repo) and from the two
reference screenshots of the original light/paper UI.

It is meant to be copied wholesale into a new repo as the source of truth, then handed to
Claude Code (or a teammate) to implement milestone by milestone.

## What instant.playlist is

A single-purpose, mobile-first PWA. You drop in a festival poster (screenshot/photo/file).
A vision model reads every artist off the poster. Each artist is resolved to their
SoundCloud profile and their most recent long DJ set (or top tracks as a fallback). The
result is one continuous, playable lineup with a persistent bottom player — and it's saved
to a local database so you can come back to it.

**No accounts. No payments. No festival marketplace.** Just: poster in → playable lineup
out → saved locally. (The original codebase later sprawled into a festival "economy"
product; this spec deliberately strips all of that back out.)

## The files

| File | Purpose |
|---|---|
| [`PRODUCT.md`](./PRODUCT.md) | Scope, user flows, screen-by-screen breakdown (from the screenshots) |
| [`DESIGN.md`](./DESIGN.md) | Visual identity: the light/paper monospace design system, tokens, components |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Stack, data model, API contracts, the four core modules, env vars |
| [`CODE_GUIDELINES.md`](./CODE_GUIDELINES.md) | Conventions distilled from the working code |
| [`BUILD_PLAN.md`](./BUILD_PLAN.md) | Milestones M0–M6, each with a concrete verification step |
| [`SKILLS.md`](./SKILLS.md) | Recommended Claude Code agent skills for the dev loop |
| [`CLAUDE.md`](./CLAUDE.md) | Drop-in project instructions for the new repo's root |

## How to use it in a new repo

1. `git init instant-playlist && cd instant-playlist`
2. Copy `CLAUDE.md` to the repo root, and this whole folder to `docs/spec/` (or keep it at root).
3. Set the four env vars (see `ARCHITECTURE.md` → Environment).
4. Work `BUILD_PLAN.md` top to bottom. Verify each milestone before moving on.

## Non-negotiables (the soul of the product)

- **One input, one output.** A poster goes in; a playable, saved lineup comes out. Resist
  every urge to add a second primary action to the landing screen.
- **The player never stops.** It's mounted once, survives navigation, and plays sets back
  to back automatically.
- **Light, paper, monospace.** The aesthetic is calm and typographic — not the later dark
  purple theme. See `DESIGN.md`.
- **Local-first.** Playlists persist to a local SQLite file. No external DB, no auth.
