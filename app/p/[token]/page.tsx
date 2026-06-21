import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPatternByToken } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "your pattern — instant.playlist",
  robots: { index: false }, // private link — keep it out of search
};

/** The creator's private status page (their kept link). No auth — the token IS the key. */
export default async function PatternStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const pattern = await getPatternByToken(token);
  if (!pattern) notFound();

  const won = pattern.selected || pattern.published;

  return (
    <main
      className="relative flex min-h-svh flex-col items-center justify-center gap-8 px-6 py-16 text-paper"
      style={{
        background: `linear-gradient(165deg, ${pattern.from} 0%, ${pattern.to} 100%)`,
      }}
    >
      <header className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-paper/50">
          your pattern
        </p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-paper/40">
          keep this link — it’s how you claim a reward
        </p>
      </header>

      {/* the pattern itself */}
      <div
        className="h-28 w-28 rounded-full"
        style={{
          background: `linear-gradient(145deg, ${pattern.from}, ${pattern.to})`,
          boxShadow: `0 0 0 3px ${pattern.accent}`,
        }}
        aria-hidden
      />

      <div className="flex flex-col items-center gap-1">
        <p
          className="font-display text-5xl font-black leading-none"
          style={{ color: pattern.accent }}
        >
          {pattern.votes}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-widest text-paper/60">
          {pattern.votes === 1 ? "vote" : "votes"}
        </p>
      </div>

      {/* status */}
      <div className="max-w-sm text-center">
        {pattern.published ? (
          <p className="font-mono text-sm" style={{ color: pattern.accent }}>
            🎉 published to socials — you won! email{" "}
            <a className="underline" href="mailto:contact@vincentbaron.me">
              contact@vincentbaron.me
            </a>{" "}
            with this page to claim your reward.
          </p>
        ) : pattern.selected ? (
          <p className="font-mono text-sm" style={{ color: pattern.accent }}>
            ✨ selected by the organiser — keep an eye here, your reward is on the way.
          </p>
        ) : (
          <p className="font-mono text-sm text-paper/70">
            in the running. share the lineup so people upvote your colors — the most
            upvoted pattern becomes the page’s default look.
          </p>
        )}
      </div>

      <Link
        href={`/${pattern.lineupSlug}`}
        className="font-mono text-xs uppercase tracking-widest text-paper/70 underline transition-colors hover:text-paper"
        style={won ? { color: pattern.accent } : undefined}
      >
        ← back to the lineup
      </Link>
    </main>
  );
}
