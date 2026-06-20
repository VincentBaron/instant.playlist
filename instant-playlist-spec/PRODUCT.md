# PRODUCT

## One-liner

Drop a festival poster — hear every artist back to back.

## Problem

You see a festival lineup poster and recognize three names out of forty. Discovering what
the rest sound like means forty manual searches. instant.playlist collapses that to a
single drop: it reads the poster and hands you a continuous, playable set of the whole
lineup.

## Scope (what's in / out)

**In scope (the MVP):**
- Drop or pick a festival poster image (incl. iPhone HEIC).
- Read all artist names off the poster with a vision model.
- Resolve each artist to a SoundCloud profile + a playable track (latest long set, else top tracks).
- Render the lineup as a grouped, playable list.
- A persistent bottom player that plays the whole lineup back to back.
- Save each generated lineup to a local database; list past lineups.

**Explicitly out of scope (do not build):**
- Accounts, login, identity.
- Payments, tickets, wallet, rewards, referrals, operator dashboards.
- A festival "radar"/aggregation across many posters.
- A typed search box / festival dropdown as the primary entry point. The original primary
  action is the **poster dropzone**. (A small dev-only text path to paste an artist list is
  fine behind the scenes, but it is not the hero.)

## Primary flow

1. **Land** on the dropzone screen.
2. **Drop** a poster (drag-and-drop on desktop, tap-to-browse on mobile). HEIC is converted
   to JPEG client-side before upload.
3. **Read** — the image is sent to the server; the vision model extracts artist names and
   (optionally) the festival name.
4. **Resolve** — each name is looked up on SoundCloud; the best playable track is attached.
5. **Save** — the resolved lineup is written to the local DB.
6. **Lineup screen** appears: artists grouped, each with its track(s), and the bottom player
   ready. Tapping any row starts the set from there; it then auto-advances through the rest.
7. **+ new poster** returns to the dropzone to start another.

A loading/progress state covers steps 3–5 (reading the poster, then "N/M resolved"). Keep it
quiet and typographic — a line of status text, not a spinner circus.

## Screens (from the reference screenshots)

### Screen 1 — Landing / dropzone

```
┌─────────────────────────────────────┐
│ instant.playlist                     │   ← small wordmark, top-left
├─────────────────────────────────────┤
│                                      │
│         instant.playlist             │   ← large centered wordmark
│  drop a festival poster — hear every │   ← muted tagline
│        artist back to back           │
│                                      │
│   ┌───────────────────────────────┐  │
│   │  Drop a poster, or tap to     │  │   ← dropzone card (thin border)
│   │           browse              │  │
│   │  Screenshot, photo or file —  │  │   ← muted subtext
│   │       iPhone HEIC works too   │  │
│   └───────────────────────────────┘  │
│                                      │   ← lots of calm empty space
└─────────────────────────────────────┘
```

- Wordmark: `instant` (green) + `.` (orange) + `playlist` (green), monospace, bold.
- The dropzone is the **only** interactive element. The whole card is a drop target and a
  file-picker trigger.

### Screen 2 — Lineup

```
┌─────────────────────────────────────┐
│ instant.playlist        + new poster │   ← wordmark + pill button
├─────────────────────────────────────┤
│ lineup            28 artists · 27 ▸  │   ← section label + count
│                                      │
│ emant sitra                          │   ← artist label (lowercase, muted)
│  ( ▷ )  Not found on SoundCloud   ⧉  │   ← disabled row (muted)
│                                      │
│ kida                                 │
│  ( ▷ )  Kida @ Hadra Trance Fes…  ⧉  │   ← playable row
│                                      │
│ recto/verso                          │
│  ( ▷ )  Paradi'spirituel          ⧉  │
│  (●▶)  Quai de Jemmapes           ⧉  │   ← ACTIVE row: green ring + filled play
│  ( ▷ )  Prend tes marques         ⧉  │
├─────────────────────────────────────┤
│ NOW PLAYING · 5/27                   │   ← sticky player
│ RECTO/VERSO — Quai de Jemmapes       │
│         ⏮   ( ▶ )   ⏭                │   ← prev / filled green play / next
│ 0:00 ▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱ 3:00     │   ← progress + times
└─────────────────────────────────────┘
```

- **Header:** wordmark left; `+ new poster` pill button right.
- **Section row:** `lineup` label left; `{artistCount} artists · {playableCount} playable` right.
- **Artist group:** a lowercase muted label, then one or more rows.
- **Row (playable):** circular outline play button · track title · external-link icon. The
  whole row is the play trigger; the external-link icon opens the track on SoundCloud.
- **Row (not found):** muted text "Not found on SoundCloud", disabled play affordance.
- **Active row:** green ring around the card and a filled green play button; shows pause glyph while playing.
- **Player bar (sticky bottom):** `NOW PLAYING · {index}/{total}` (uppercase, muted) over
  `{ARTIST} — {Track title}` (bold). Prev · filled-green Play/Pause · Next. Progress bar with
  current time and total time. Tapping the bar seeks.

## States & edge cases

- **No artists found on poster:** show a calm message and a "try another poster" affordance.
- **Artist not on SoundCloud:** keep the row, mark "Not found on SoundCloud", skip it in playback.
- **Artist found, no long set:** fall back to top 3 tracks (each becomes its own row).
- **Large / HEIC images:** convert HEIC→JPEG client-side; enforce a max upload size (~8 MB).
- **Slow resolution:** the lineup can render progressively; the player only queues playable tracks.
- **Offline:** the app shell loads from the service-worker cache; scanning needs network.

## Success criteria

- From dropping a recognizable poster to a playing lineup in well under a minute.
- ≥ ~80% of legible poster names resolve to a playable SoundCloud track.
- Playback advances automatically through the whole lineup without user input.
- Re-opening the app shows previously saved lineups.
