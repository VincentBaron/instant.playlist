# DESIGN SYSTEM

The original instant.playlist look is **calm, paper-light, and typographic** — a warm
off-white canvas, a single deep-green brand color with one orange accent, and a monospace
typeface used everywhere. It reads like a well-set terminal, not a neon music app.

> Note: this is intentionally **not** the later dark-purple "Deezer" theme. If you find dark
> backgrounds, `#a238ff` purple, mint accents, or an Archivo Black wordmark, that's the wrong
> iteration. Stick to the tokens below.

## Color tokens

```css
:root {
  --paper:         #ECEAE0; /* app background — warm light beige-gray */
  --surface:       #FBFAF5; /* cards / rows — near-white, warm */
  --ink:           #1B1B18; /* primary text — near-black */
  --muted:         #8E8C82; /* labels, secondary text, icons */
  --green:         #1F4D2E; /* brand wordmark, player, active state, play fill */
  --green-ink:     #FBFAF5; /* glyph color on filled green */
  --orange:        #E0531F; /* the accent dot in "instant.playlist" */
  --border:        #DAD7CC; /* hairline borders on cards/rows */
  --border-strong: rgba(27, 27, 24, 0.45); /* dropzone outline */
  --active-ring:   var(--green);
}
```

Use flat fills and hairline borders. No gradients, no drop shadows beyond an optional
1px hairline. Contrast comes from the green and from type weight, not from color noise.

## Typography

- **One family: monospace.** Recommended: **JetBrains Mono** (or Space Mono / IBM Plex Mono).
  Self-host or load from Google Fonts. Fallback stack:
  `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`.
- The wordmark is heavy (700–800). Body and labels are 400–500.
- Labels (`lineup`, artist names) are **lowercase**. The player's `NOW PLAYING` is uppercase.

| Role | Size | Weight | Case | Color |
|---|---|---|---|---|
| Hero wordmark | `clamp(2.4rem, 12vw, 3.4rem)` | 800 | as-is | green / orange dot |
| Header wordmark | `1rem` | 700 | as-is | green / orange dot |
| Tagline | `0.95rem` | 400 | lowercase | muted |
| Dropzone primary | `1rem` | 600 | sentence | ink |
| Dropzone subtext | `0.85rem` | 400 | sentence | muted |
| Section label (`lineup`) | `0.85rem` | 500 | lowercase | muted |
| Count | `0.85rem` | 400 | lowercase | muted |
| Artist group label | `0.8rem` | 500 | lowercase | muted |
| Row title | `0.95rem` | 500 | as-is | ink |
| Player "NOW PLAYING" | `0.7rem` | 600 | UPPERCASE, +0.08em tracking | muted |
| Player title | `0.95rem` | 700 | as-is | ink |

## The wordmark

`instant` + `.` + `playlist`, all one monospace run.
- `instant` and `playlist`: `--green`.
- The `.` (period): `--orange`.
- No space around the dot; it's part of the logotype.

```html
<span class="wordmark"><span>instant</span><b class="dot">.</b><span>playlist</span></span>
```
```css
.wordmark { font-weight: 800; color: var(--green); letter-spacing: -0.01em; }
.wordmark .dot { color: var(--orange); }
```

## Layout

- **Mobile-first, single column.** Content max-width ~`640px`, centered, with ~`20px` side padding.
- A thin `--border` divider under the header.
- Generous vertical rhythm; the landing screen is mostly calm empty space below the dropzone.
- The player bar is `position: sticky`/`fixed` to the bottom; add bottom padding to the
  scroll container (a `has-player` body class) so the last rows aren't hidden behind it.

## Components

### Dropzone card
- Rounded `16px`, fill `--surface`, `1px solid --border-strong`.
- Centered two-line text (primary + muted subtext). Entire card is the drop target and the
  click-to-browse trigger (hidden `<input type="file" accept="image/*">`).
- On drag-over: subtly emphasize the border (e.g. switch to `--green`).

### Row (lineup item)
- Rounded `14px`, fill `--surface`, `1px solid --border`. Comfortable padding (~`14px 16px`).
- Left: circular play button — `1px solid --muted` ring, `--ink` triangle glyph.
- Center: track title (ink), truncated with ellipsis on overflow.
- Right: external-link icon (`--muted`), opens the track in a new tab; stops row-click propagation.
- **Active:** card border becomes `--green` (a ring); play button becomes a filled `--green`
  circle with a `--green-ink` glyph; shows the pause glyph while playing.
- **Disabled / not found:** muted title text, no hover/active, play affordance dimmed.

### Pill button (`+ new poster`)
- Rounded-full, `1px solid --border`, transparent fill, ink text, compact padding.

### Player bar
- Full-width, `--paper` background, `1px solid --border` top border.
- Top line: `NOW PLAYING · {i}/{n}` (muted, uppercase) and the bold `{ARTIST} — {Title}`.
- Controls: prev, a large filled-`--green` circular play/pause, next. Disabled controls dim.
- Progress: `current` time · clickable track (`--border` track, `--green` fill) · `total` time.
- Optional small artwork thumbnail to the left of the meta (hide on image error).

## Motion

Keep it understated. The original uses `motion` (Framer Motion successor) sparingly:
- A soft fade/slide when the lineup reveals after a scan.
- Optional View Transitions API morph from the dropzone to the lineup.
- No bouncing, no looping animations. Respect `prefers-reduced-motion`.

## Iconography

Inline SVG, `currentColor`, ~`15–18px`, `1.7` stroke for outline icons:
play (filled triangle), pause (two bars), prev/next (bar + triangle), external-link (arrow
out of box). Keep them crisp and minimal.
