# AGENT SKILLS

Recommended Claude Code skills for the new repo, to make the dev loop fast and to encode the
project's hard-won knowledge. Put each under `.claude/skills/<name>/SKILL.md` with a small
script if needed. Definitions below are starting points — adapt as the code lands.

> Also lean on the built-in **claude-api** skill whenever you touch the vision module
> (model id, vision input format, tool-use shape) and the built-in **run** / **verify**
> skills to launch and confirm the app.

---

## 1. `run` — launch & smoke-test the app

```markdown
---
name: run
description: Start the instant.playlist dev server on :3001 and confirm the dropzone renders.
---

1. Ensure `.env` has ANTHROPIC_API_KEY, SOUNDCLOUD_CLIENT_ID, SOUNDCLOUD_OAUTH_TOKEN.
2. `npm run dev` (port 3001).
3. Open http://localhost:3001 and confirm the dropzone landing renders on the paper bg.
4. Report the URL and any startup errors.
```

## 2. `scan-poster` — exercise the full pipeline from a poster file

```markdown
---
name: scan-poster
description: Run a local poster image through POST /api/playlist and report the resolved lineup.
  Use to test vision + SoundCloud resolution end to end.
---

Given an image path:
1. Base64-encode it; detect mediaType (png/jpeg/webp/gif).
2. POST { image, mediaType } to http://localhost:3001/api/playlist.
3. Print: festival name (if any), artistCount, playableCount, and the first ~10 rows
   (artist → track title or "Not found").
4. Flag any artist that resolved to an obviously wrong account.
```

## 3. `soundcloud-creds` — refresh the SoundCloud client id / OAuth token

```markdown
---
name: soundcloud-creds
description: Diagnose and refresh expired SoundCloud client_id / OAuth token when resolution
  starts returning empty artists or 401s.
---

1. Hit a known SoundCloud search via lib/soundcloud.ts headers; if 401/empty, creds are stale.
2. Walk the user through capturing a fresh client_id + OAuth token from a browser session.
3. Update .env; re-run `scan-poster` on a known-good poster to confirm resolution recovers.
4. Remind: these are unofficial/internal API creds and will expire again.
```

## 4. `new-screen` — scaffold a screen on the design system

```markdown
---
name: new-screen
description: Scaffold a new screen/component using the instant.playlist light/paper monospace
  tokens and conventions.
---

1. Read docs/spec/DESIGN.md for tokens and component rules.
2. Generate a server component by default; add "use client" only if interactive.
3. Use the CSS custom properties (--paper, --ink, --green, --orange, --muted, --border).
4. Keep it mobile-first, single column, monospace, lowercase labels. No purple/dark theme.
```

---

### Why these

- `run` / `scan-poster` make "did it actually work?" a one-command answer — the build plan
  leans on real verification, not just compilation.
- `soundcloud-creds` captures the single most likely source of silent breakage (the
  unofficial SoundCloud API creds expiring).
- `new-screen` keeps every new surface on-brand and prevents drift back toward the dark theme.
