import Link from "next/link";
import { listLineups } from "@/lib/db";

// Same per-request DB read as the home teaser.
export const dynamic = "force-dynamic";

export default async function Browse() {
  const lineups = await listLineups();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12 pb-32 sm:py-16">
      <header>
        <p className="font-mono text-sm tracking-tight text-ink">
          instant<span className="text-ember">.</span>playlist
        </p>
        <h1 className="mt-4 font-display text-4xl font-black uppercase leading-[0.92] tracking-tight">
          All lineups
        </h1>
      </header>

      {lineups.length > 0 ? (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {lineups.map((l) => (
            <li key={l.slug}>
              <Link
                href={`/${l.slug}`}
                className="flex items-baseline justify-between gap-4 py-3 transition-colors hover:text-ember"
              >
                <span className="font-display text-lg font-bold uppercase leading-none">
                  {l.festival ?? l.title}
                </span>
                <span className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted">
                  {l.playableCount} playable
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-mono text-sm text-muted">No lineups yet.</p>
      )}
    </main>
  );
}
