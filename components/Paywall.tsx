"use client";

import { bmcUrl, CREDIT_PACKS, formatPrice } from "@/lib/packs";

/*
 * The paywall — shown when a signed-in user runs out of scans. Deliberately transparent:
 * every option states exactly how many posters the credits buy ("N scans"). Support goes
 * through Buy Me a Coffee (opens in a new tab); the webhook grants credits by matching the
 * payer's email, so the copy nudges people to pay with their account email. Back on this
 * tab, the Dropzone re-reads the balance on focus/next load.
 */
export default function Paywall({ message }: { message?: string }) {
  const url = bmcUrl();

  return (
    <div className="flex flex-col gap-4 border border-ember bg-white/40 p-6">
      <div className="flex flex-col gap-1">
        <p className="font-display text-2xl font-black uppercase leading-none text-ember">
          {message ?? "you're out of free scans"}
        </p>
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          support on buy me a coffee — 1 credit = 1 poster scan
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {CREDIT_PACKS.map((p) => (
          <li key={p.id}>
            <a
              href={url ?? "#"}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!url}
              className={`flex w-full items-baseline justify-between gap-4 border border-line bg-white/50 px-4 py-3 text-left transition-colors hover:border-ink ${
                url ? "" : "pointer-events-none opacity-60"
              }`}
            >
              <span className="font-display text-lg font-black uppercase leading-none">
                {p.credits} scans
              </span>
              <span className="font-mono text-sm font-bold text-ink">
                {formatPrice(p.priceCents)}
              </span>
            </a>
          </li>
        ))}
      </ul>

      <p className="font-mono text-[11px] leading-relaxed text-muted">
        pay with your account email so we can add your scans automatically — they usually
        land within a few minutes.
      </p>

      {!url && (
        <p className="font-mono text-xs text-ember">
          support link not configured yet — check back soon.
        </p>
      )}
    </div>
  );
}
