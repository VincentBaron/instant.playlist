import Dropzone from "@/components/Dropzone";
import BrowseAllLink from "@/components/BrowseAllLink";
import Wordmark from "@/components/Wordmark";
import ScatteredFestivals from "@/components/ScatteredFestivals";
import { listLineups } from "@/lib/db";

// The recent index reads the DB per request.
export const dynamic = "force-dynamic";

export default async function Home() {
  const lineups = await listLineups();

  return (
    // The home page IS a poster: every festival scattered around a centered headline + CTA.
    <main className="relative flex min-h-svh w-full flex-1 flex-col overflow-x-hidden">
      {/* scattered festival names frame the page (seeded, click → autoplay that lineup) */}
      <ScatteredFestivals lineups={lineups} />

      {/* centered column — sits above the scatter; soft paper glow keeps it legible over any
          overlapping names. Kept narrow so the scatter reads as the surrounding poster. */}
      <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_55%_at_center,var(--paper)_35%,transparent_100%)]"
        />

        {/* wordmark — mono, reads like a domain; ember dot = brand heartbeat */}
        <Wordmark className="pointer-events-auto font-mono text-sm tracking-tight text-ink" />

        {/* the human-curated poster voice — Archivo, big */}
        <header>
          <h1 className="font-display text-5xl font-black uppercase leading-[0.92] tracking-tight sm:text-6xl">
            Point at any poster.
            <br />
            Hear the lineup.
          </h1>
          <p className="mx-auto mt-4 max-w-md font-mono text-sm leading-relaxed text-muted">
            Scan a festival poster → a public, shareable page that plays the whole
            lineup&apos;s SoundCloud DJ sets back to back.
          </p>
        </header>

        <div className="pointer-events-auto w-full">
          <Dropzone />
        </div>

        {lineups.length > 0 && (
          <div className="pointer-events-auto">
            <BrowseAllLink count={lineups.length} />
          </div>
        )}
      </div>
    </main>
  );
}
