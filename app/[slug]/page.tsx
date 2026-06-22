import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import LineupView from "@/components/LineupView";
import LineupCanvas from "@/components/LineupCanvas";
import ShareControls from "@/components/ShareControls";
import { getLineupBySlug, getTopPattern, listPatterns } from "@/lib/db";
import { qrDataUrl } from "@/lib/qr";
import { HOUSE_PATTERN, type Pattern } from "@/lib/themes";

export const dynamic = "force-dynamic";

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lineup = await getLineupBySlug(slug);
  if (!lineup) return { title: "instant.playlist" };
  const name = lineup.festival ?? lineup.title;
  return {
    title: `${name} — instant.playlist`,
    description: `Hear ${name}: ${lineup.playableCount} DJ sets, back to back.`,
  };
}

/** UTM-tag the official ticket link so promoters see attributed traffic (free now). */
function ticketHref(url: string, slug: string): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", "instant.playlist");
  u.searchParams.set("utm_medium", "lineup");
  u.searchParams.set("utm_campaign", slug);
  return u.toString();
}

export default async function LineupPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { slug } = await params;
  const lineup = await getLineupBySlug(slug);
  if (!lineup) notFound();

  const pageUrl = `${await origin()}/${slug}`;
  const qr = await qrDataUrl(pageUrl);
  const name = lineup.festival ?? lineup.title;

  // The default look is the top-voted community pattern (or the house default). A `?p=<id>`
  // link focuses a specific posted pattern so a remix can be shared at its exact colors.
  const [posted, top] = await Promise.all([listPatterns(slug), getTopPattern(slug)]);
  const { p } = await searchParams;
  const focusId = p ? Number(p) : NaN;
  const chosen =
    (Number.isFinite(focusId) ? posted.find((x) => x.id === focusId) : undefined) ??
    top;
  const initialPattern: Pattern = chosen
    ? { from: chosen.from, to: chosen.to, accent: chosen.accent, grain: chosen.grain }
    : HOUSE_PATTERN;

  return (
    // dark poster field + riso grain + community pattern — the hero surface
    <LineupCanvas
      slug={slug}
      patterns={posted}
      initialPattern={initialPattern}
    >
      {/* top nav — an obvious way back to browse all lineups */}
      <nav>
          <Link
            href="/"
            className="-ml-1 inline-flex items-center gap-2 px-1 py-1 font-mono text-xs uppercase tracking-widest text-paper/80 transition-colors hover:text-acid"
          >
            <span aria-hidden>←</span>
            <span>
              instant<span className="text-ember">.</span>playlist
            </span>
          </Link>
        </nav>

        {/* header — festival in display */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-display text-3xl font-black uppercase leading-none tracking-tight sm:text-4xl">
            {name}
          </h1>
          <p className="font-mono text-xs uppercase tracking-widest text-paper/50">
            {lineup.artistCount} artists · {lineup.playableCount} playable · tap a name
          </p>
        </div>

        {/* the playable poster */}
        <div className="flex flex-1 items-center justify-center">
          <LineupView lineup={lineup} />
        </div>

        {/* ticket CTA (only when a verified official URL exists) + share + QR */}
        <div className="flex flex-col items-center gap-6">
          {lineup.officialTicketUrl && (
            <a
              href={ticketHref(lineup.officialTicketUrl, slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center bg-acid px-6 py-3 font-mono text-sm font-bold uppercase text-ink"
            >
              🎟 get tickets
            </a>
          )}
          <ShareControls qrDataUrl={qr} slug={slug} title={name} />
        </div>
    </LineupCanvas>
  );
}
