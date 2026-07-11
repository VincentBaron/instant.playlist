import Link from "next/link";
import Dropzone from "@/components/Dropzone";
import BrowseAllLink from "@/components/BrowseAllLink";
import Wordmark from "@/components/Wordmark";
import { listLineups } from "@/lib/db";

// The recent index reads the DB per request.
export const dynamic = "force-dynamic";

const RECENT_LIMIT = 5;

export default async function Home() {
  const recent = await listLineups();
  const teaser = recent.slice(0, RECENT_LIMIT);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-12 px-6 py-12 pb-32 sm:py-16">
      {/* wordmark — mono, reads like a domain; ember dot = brand heartbeat */}
      <Wordmark className="font-mono text-sm tracking-tight text-ink" />

      {/* the human-curated poster voice — Archivo, big */}
      <header>
        <h1 className="font-display text-5xl font-black uppercase leading-[0.92] tracking-tight sm:text-6xl">
          Point at any poster.
          <br />
          Hear the lineup.
        </h1>
        <p className="mt-4 max-w-md font-mono text-sm leading-relaxed text-muted">
          Scan a festival poster → a public, shareable page that plays the whole
          lineup&apos;s SoundCloud DJ sets back to back.
        </p>
      </header>

      <Dropzone />

      {recent.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted">
            recent lineups
          </h2>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {teaser.map((l) => (
              <li key={l.slug}>
                <Link
                  href={`/${l.slug}`}
                  className="flex items-baseline justify-between gap-4 py-3 transition-colors hover:text-ember"
                >
                  <span className="font-display text-lg font-bold uppercase leading-none">
                    {l.festival ?? l.title}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2 font-mono text-xs uppercase tracking-widest text-muted">
                    {l.genres.length > 0 && (
                      <span className="text-ink">{l.genres.slice(0, 2).join(" / ")}</span>
                    )}
                    {l.playableCount} playable
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {recent.length > RECENT_LIMIT && (
            <BrowseAllLink count={recent.length} />
          )}
        </section>
      )}
    </main>
  );
}
