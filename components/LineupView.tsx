"use client";

import type { Artist, LineupRecord } from "@/types";
import { usePlayer, type QueueItem } from "@/components/player/PlayerProvider";

/*
 * THE signature: the lineup IS a playable poster. Headliners huge → undercard packed
 * small, every name a live row. The playing name lights --acid with an --ember pulse.
 */

type BuiltQueue = {
  items: QueueItem[];
  firstIndexByArtist: number[]; // -1 when the artist is non-playable
  artistByItem: number[];
};

function buildQueue(artists: Artist[]): BuiltQueue {
  const items: QueueItem[] = [];
  const firstIndexByArtist: number[] = [];
  const artistByItem: number[] = [];
  artists.forEach((a, ai) => {
    const tracks = a.set ? [a.set] : a.topTracks;
    if (tracks.length === 0) {
      firstIndexByArtist[ai] = -1;
      return;
    }
    firstIndexByArtist[ai] = items.length;
    for (const t of tracks) {
      items.push({
        url: t.url,
        title: t.title,
        artist: a.name,
        durationMin: t.durationMin,
        artworkUrl: t.artworkUrl,
      });
      artistByItem.push(ai);
    }
  });
  return { items, firstIndexByArtist, artistByItem };
}

// Poster sizing encodes tempo: faster sets read bigger. Continuous fluid size via clamp()
// (Tailwind's discrete text-* steps can't express a proportional scale); unknown → smallest.
function fontSizeFor(bpm: number | null): string {
  if (bpm == null) return "clamp(1rem, 3vw, 1.25rem)"; // unknown tempo → smallest
  const t = Math.min(1, Math.max(0, (bpm - 100) / (175 - 100))); // clamp domain 100–175 BPM
  const lerp = (a: number, b: number) => (a + (b - a) * t).toFixed(2);
  return `clamp(${lerp(1.0, 2.5)}rem, ${lerp(4, 10)}vw, ${lerp(1.25, 5.0)}rem)`;
}

export default function LineupView({ lineup }: { lineup: LineupRecord }) {
  const player = usePlayer();
  const { items, firstIndexByArtist, artistByItem } = buildQueue(lineup.artists);

  const activeArtist =
    player.queueId === lineup.slug ? (artistByItem[player.index] ?? -1) : -1;

  return (
    <div className="flex flex-col flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center">
      {lineup.artists.map((artist, ai) => {
        const playable = firstIndexByArtist[ai] >= 0;
        const active = ai === activeArtist;
        return (
          <button
            key={`${artist.name}-${ai}`}
            type="button"
            disabled={!playable}
            onClick={() =>
              playable && player.playQueue(lineup.slug, items, firstIndexByArtist[ai])
            }
            style={{ fontSize: fontSizeFor(artist.set?.bpm ?? null) }}
            className={[
              "font-display font-black uppercase leading-[0.95] tracking-tight transition-colors",
              active
                ? "text-acid"
                : playable
                  ? "text-paper hover:text-acid"
                  : "cursor-default text-muted/50",
            ].join(" ")}
          >
            {artist.name}
            {active && (
              <span className="ml-2 inline-block h-2 w-2 rounded-full bg-ember align-middle motion-safe:animate-pulse" />
            )}
          </button>
        );
      })}
    </div>
  );
}
