export default function Home() {
  return (
    <main className="flex flex-1 flex-col justify-between gap-16 px-6 py-12 sm:px-10 sm:py-16">
      {/* wordmark — mono, reads like a domain; ember dot = brand heartbeat */}
      <p className="font-mono text-sm tracking-tight text-ink">
        instant<span className="text-ember">.</span>playlist
      </p>

      {/* the human-curated poster voice — Archivo, big */}
      <div className="max-w-3xl">
        <h1 className="font-display text-5xl font-black uppercase leading-[0.92] tracking-tight sm:text-7xl">
          Hear the lineup.
          <br />
          Point at any poster.
        </h1>
        <p className="mt-6 max-w-md font-mono text-sm leading-relaxed text-muted">
          Scan a festival poster → a public, shareable page that plays the whole
          lineup&apos;s SoundCloud DJ sets back to back.
        </p>
      </div>

      {/* M0 token check-strip + the acid CTA */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center bg-acid px-4 py-2 font-mono text-sm font-bold uppercase text-ink">
            ▶ play the bill
          </span>
          <span className="font-mono text-xs uppercase tracking-widest text-muted">
            M0 · scaffold live
          </span>
        </div>
        <div className="flex gap-2">
          {(["paper", "ink", "acid", "ember", "muted", "line"] as const).map(
            (token) => (
              <div key={token} className="flex flex-col items-center gap-1">
                <div
                  className="h-10 w-10 border border-line"
                  style={{ background: `var(--${token})` }}
                />
                <span className="font-mono text-[10px] text-muted">
                  {token}
                </span>
              </div>
            ),
          )}
        </div>
      </div>
    </main>
  );
}
