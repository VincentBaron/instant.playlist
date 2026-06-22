"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ACCENTS, BACKGROUNDS, DEFAULT_GRAIN, type Pattern } from "@/lib/themes";
import type { PatternPublic } from "@/lib/db";

/*
 * The lineup's community canvas. The displayed look is the top-voted posted pattern (or
 * the house default). A discreet dot opens the picker: browse + upvote posted patterns, or
 * compose a new one from curated swatches and post it — which returns a private link the
 * creator keeps (their identity + reward channel; no auth anywhere). Curated dark
 * gradients keep the type legible by construction.
 */
const votedKey = (slug: string) => `ip:voted:${slug}`;
const mineKey = (slug: string) => `ip:mypatterns:${slug}`;

function readVoted(slug: string): Set<number> {
  try {
    const raw = localStorage.getItem(votedKey(slug));
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set();
  }
}

function samePattern(a: Pattern, b: Pattern): boolean {
  return a.from === b.from && a.to === b.to && a.accent === b.accent;
}

export default function LineupCanvas({
  slug,
  patterns,
  initialPattern,
  children,
}: {
  slug: string;
  patterns: PatternPublic[];
  initialPattern: Pattern;
  children: ReactNode;
}) {
  const [applied, setApplied] = useState<Pattern>(initialPattern);
  const [list, setList] = useState<PatternPublic[]>(patterns);
  const [voted, setVoted] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"browse" | "compose">("browse");
  const [bgIdx, setBgIdx] = useState(0);
  const [accentIdx, setAccentIdx] = useState(0);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const restore = useRef<Pattern>(initialPattern);

  useEffect(() => {
    // Post-hydration sync: localStorage (the device's vote guard) isn't readable in SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoted(readVoted(slug));
  }, [slug]);

  const draft: Pattern = {
    from: BACKGROUNDS[bgIdx].from,
    to: BACKGROUNDS[bgIdx].to,
    accent: ACCENTS[accentIdx],
    grain: DEFAULT_GRAIN,
  };

  function enterCompose() {
    restore.current = applied;
    setBgIdx(0);
    setAccentIdx(0);
    setApplied({ ...BACKGROUNDS[0], accent: ACCENTS[0], grain: DEFAULT_GRAIN });
    setError(null);
    setCreatedLink(null);
    setMode("compose");
  }

  function cancelCompose() {
    setApplied(restore.current);
    setMode("browse");
  }

  function pickBg(i: number) {
    setBgIdx(i);
    setApplied({ from: BACKGROUNDS[i].from, to: BACKGROUNDS[i].to, accent: ACCENTS[accentIdx], grain: DEFAULT_GRAIN });
  }
  function pickAccent(i: number) {
    setAccentIdx(i);
    setApplied({ from: BACKGROUNDS[bgIdx].from, to: BACKGROUNDS[bgIdx].to, accent: ACCENTS[i], grain: DEFAULT_GRAIN });
  }

  async function post() {
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/lineups/${slug}/patterns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = (await res.json().catch(() => null)) as
        | { pattern: PatternPublic & { token: string }; link: string; error?: string }
        | null;
      if (!res.ok || !json?.pattern) {
        throw new Error(json?.error ?? "couldn't post your pattern");
      }
      setList((l) => [...l, json.pattern]);
      const link = `${window.location.origin}${json.link}`;
      setCreatedLink(link);
      try {
        const prev = JSON.parse(localStorage.getItem(mineKey(slug)) ?? "[]") as string[];
        localStorage.setItem(mineKey(slug), JSON.stringify([...prev, link]));
      } catch {
        /* storage blocked — the link is still shown on screen */
      }
      setMode("browse");
    } catch (e) {
      setError(e instanceof Error ? e.message : "couldn't post your pattern");
    } finally {
      setPosting(false);
    }
  }

  async function vote(p: PatternPublic) {
    if (voted.has(p.id)) return;
    // optimistic: bump + lock immediately, persist the device guard.
    setList((l) => l.map((x) => (x.id === p.id ? { ...x, votes: x.votes + 1 } : x)));
    const next = new Set(voted).add(p.id);
    setVoted(next);
    try {
      localStorage.setItem(votedKey(slug), JSON.stringify([...next]));
    } catch {
      /* non-fatal */
    }
    try {
      const res = await fetch(`/api/lineups/${slug}/patterns/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patternId: p.id }),
      });
      const json = (await res.json().catch(() => null)) as { votes?: number } | null;
      if (json && typeof json.votes === "number") {
        const v = json.votes;
        setList((l) => l.map((x) => (x.id === p.id ? { ...x, votes: v } : x)));
      }
    } catch {
      /* keep the optimistic count — a refresh reconciles */
    }
  }

  return (
    <main
      className="grain relative flex min-h-svh flex-col bg-ink text-paper"
      style={
        { "--acid": applied.accent, "--grain-opacity": applied.grain } as CSSProperties
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 transition-[background] duration-500"
        style={{ background: `linear-gradient(165deg, ${applied.from} 0%, ${applied.to} 100%)` }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-12 pb-32 sm:py-16">
        {children}
      </div>

      <PatternPicker
        open={open}
        onToggle={() => {
          setOpen((v) => !v);
          if (mode === "compose") cancelCompose();
          setCreatedLink(null);
        }}
        accent={applied.accent}
        mode={mode}
        list={list}
        voted={voted}
        appliedPattern={applied}
        onApply={setApplied}
        onVote={vote}
        onEnterCompose={enterCompose}
        onCancelCompose={cancelCompose}
        bgIdx={bgIdx}
        accentIdx={accentIdx}
        onPickBg={pickBg}
        onPickAccent={pickAccent}
        onPost={post}
        posting={posting}
        error={error}
        createdLink={createdLink}
        onDismissLink={() => setCreatedLink(null)}
      />
    </main>
  );
}

function PatternPicker(props: {
  open: boolean;
  onToggle: () => void;
  accent: string;
  mode: "browse" | "compose";
  list: PatternPublic[];
  voted: Set<number>;
  appliedPattern: Pattern;
  onApply: (p: Pattern) => void;
  onVote: (p: PatternPublic) => void;
  onEnterCompose: () => void;
  onCancelCompose: () => void;
  bgIdx: number;
  accentIdx: number;
  onPickBg: (i: number) => void;
  onPickAccent: (i: number) => void;
  onPost: () => void;
  posting: boolean;
  error: string | null;
  createdLink: string | null;
  onDismissLink: () => void;
}) {
  const {
    open,
    onToggle,
    accent,
    mode,
    list,
    voted,
    appliedPattern,
    onApply,
    onVote,
    onEnterCompose,
    bgIdx,
    accentIdx,
    onPickBg,
    onPickAccent,
    onPost,
    posting,
    error,
    createdLink,
    onDismissLink,
  } = props;

  return (
    <div className="fixed bottom-20 right-5 z-40 flex flex-col-reverse items-end gap-2.5">
      {/* trigger — a quiet dot in the current accent */}
      <button
        type="button"
        onClick={onToggle}
        aria-label="patterns"
        aria-expanded={open}
        className="h-4 w-4 self-center rounded-full opacity-50 transition-all duration-300 hover:opacity-100"
        style={{ background: accent, boxShadow: "0 0 0 4px rgba(0,0,0,0.2)" }}
      />

      {open && createdLink && (
        <LinkToast link={createdLink} onDismiss={onDismissLink} accent={accent} />
      )}

      {open && !createdLink && mode === "compose" && (
        <div className="w-56 rounded-xl border border-line/20 bg-ink/85 p-3 shadow-xl backdrop-blur-md">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-paper/55">
            background
          </p>
          <div className="grid grid-cols-4 gap-2">
            {BACKGROUNDS.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onPickBg(i)}
                className={`h-8 w-8 rounded-full transition-transform motion-safe:hover:scale-110 ${i === bgIdx ? "scale-110" : ""}`}
                style={{
                  background: `linear-gradient(145deg, ${b.from}, ${b.to})`,
                  boxShadow: i === bgIdx ? `0 0 0 2px ${accent}` : "inset 0 0 0 1px #ffffff22",
                }}
                aria-label={b.id}
              />
            ))}
          </div>
          <p className="mb-2 mt-3 font-mono text-[10px] uppercase tracking-widest text-paper/55">
            accent
          </p>
          <div className="grid grid-cols-8 gap-1.5">
            {ACCENTS.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => onPickAccent(i)}
                className={`h-5 w-5 rounded-full transition-transform motion-safe:hover:scale-110 ${i === accentIdx ? "scale-110" : ""}`}
                style={{ background: c, boxShadow: i === accentIdx ? "0 0 0 2px #ffffffcc" : "none" }}
                aria-label={`accent ${i + 1}`}
              />
            ))}
          </div>
          {error && <p className="mt-2 font-mono text-[10px] text-ember">{error}</p>}
          <button
            type="button"
            onClick={onPost}
            disabled={posting}
            className="mt-3 w-full bg-acid py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-ink disabled:opacity-50"
          >
            {posting ? "posting…" : "post pattern"}
          </button>
        </div>
      )}

      {open && !createdLink && mode === "browse" && (
        <div className="flex flex-col items-end gap-2">
          {list.map((p) => {
            const isOn = samePattern(appliedPattern, p);
            const didVote = voted.has(p.id);
            return (
              <div key={p.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onVote(p)}
                  disabled={didVote}
                  className={`font-mono text-[11px] tabular-nums transition-colors ${
                    didVote ? "text-paper/40" : "text-paper/70 hover:text-paper"
                  }`}
                  aria-label="upvote pattern"
                >
                  ▲ {p.votes}
                </button>
                <button
                  type="button"
                  onClick={() => onApply(toPattern(p))}
                  className={`h-7 w-7 rounded-full transition-transform motion-safe:hover:scale-110 ${isOn ? "scale-110" : ""}`}
                  style={{
                    background: `linear-gradient(145deg, ${p.from}, ${p.to})`,
                    boxShadow: isOn ? `0 0 0 2px ${p.accent}` : `inset 0 0 0 1px ${p.accent}55`,
                  }}
                  aria-label="preview pattern"
                />
              </div>
            );
          })}
          {/* compose entry */}
          <button
            type="button"
            onClick={onEnterCompose}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-paper/40 text-paper/70 transition-colors hover:border-acid hover:text-acid"
            aria-label="create a pattern"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

function LinkToast({
  link,
  onDismiss,
  accent,
}: {
  link: string;
  onDismiss: () => void;
  accent: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }
  return (
    <div className="w-60 rounded-xl border border-line/20 bg-ink/90 p-3 shadow-xl backdrop-blur-md">
      <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: accent }}>
        posted — keep your link
      </p>
      <p className="mt-1 break-all font-mono text-[10px] text-paper/70">{link}</p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="font-mono text-[11px] uppercase tracking-widest text-paper underline hover:text-acid"
        >
          {copied ? "copied" : "copy"}
        </button>
        <a
          href={link}
          className="font-mono text-[11px] uppercase tracking-widest text-paper/70 underline hover:text-acid"
        >
          open
        </a>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto font-mono text-[11px] uppercase tracking-widest text-paper/50 hover:text-paper"
        >
          done
        </button>
      </div>
    </div>
  );
}

function toPattern(p: PatternPublic): Pattern {
  return { from: p.from, to: p.to, accent: p.accent, grain: p.grain };
}
