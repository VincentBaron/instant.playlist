import Link from "next/link";
import type { LineupSummary } from "@/types";
import { fontSizeForTier, scatterPlacements } from "@/lib/scatter";

/*
 * The home page IS a lineup poster: every festival name scattered around the centered
 * headline + CTA, like acts on a bill. Positions are seeded per slug (see lib/scatter.ts)
 * so this renders identically on server and client. Each name links to its lineup and
 * flags autoplay (?play=1) so the first set starts on arrival.
 *
 * Server-safe (no client state) — just positioned links. The center safe-zone is left
 * open by the scatter geometry; the centered column sits above this layer.
 */
export default function ScatteredFestivals({
  lineups,
}: {
  lineups: LineupSummary[];
}) {
  const placements = scatterPlacements(lineups);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {placements.map(({ lineup, topPct, leftPct, rotate, tier }) => {
        const name = lineup.festival ?? lineup.title;
        const playable = lineup.playableCount > 0;
        return (
          <Link
            key={lineup.slug}
            href={`/${lineup.slug}?play=1`}
            style={{
              top: `${topPct}%`,
              left: `${leftPct}%`,
              fontSize: fontSizeForTier(tier),
              transform: `rotate(${rotate.toFixed(2)}deg)`,
            }}
            className={[
              "pointer-events-auto absolute inline-block max-w-[42vw] origin-center font-display font-black uppercase leading-[0.9] tracking-tight transition-colors",
              playable ? "text-ink hover:text-ember" : "text-muted/60 hover:text-muted",
            ].join(" ")}
          >
            {name}
          </Link>
        );
      })}
    </div>
  );
}
