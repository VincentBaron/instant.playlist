"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/*
 * The player is mounted ONCE in the root layout and survives navigation — a hidden
 * SoundCloud Widget iframe drives playback so audio never stops between pages. Views
 * push a queue to it via playQueue(); they don't own playback state.
 */
export type QueueItem = {
  url: string; // SoundCloud permalink
  title: string;
  artist: string;
  durationMin: number;
  artworkUrl: string | null;
};

type PlayerContextValue = {
  queueId: string | null;
  index: number;
  isPlaying: boolean;
  current: QueueItem | null;
  /** Start (or jump within) a queue. queueId is stable per lineup (its slug). */
  playQueue: (queueId: string, items: QueueItem[], startIndex: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within <PlayerProvider>");
  return ctx;
}

// Minimal typing for the SoundCloud Widget API (loaded from their CDN).
interface SCWidget {
  bind(event: string, cb: (e?: { relativePosition?: number }) => void): void;
  load(url: string, opts: Record<string, unknown>): void;
  play(): void;
  toggle(): void;
  seekTo(milliseconds: number): void;
  getPosition(cb: (milliseconds: number) => void): void;
  getDuration(cb: (milliseconds: number) => void): void;
}
interface SCStatic {
  Widget: ((el: HTMLIFrameElement) => SCWidget) & {
    Events: Record<string, string>;
  };
}
declare global {
  interface Window {
    SC?: SCStatic;
  }
}

const WIDGET_API = "https://w.soundcloud.com/player/api.js";

function widgetSrc(url: string): string {
  const params = new URLSearchParams({
    url,
    auto_play: "true",
    visual: "false",
    show_artwork: "false",
    show_comments: "false",
    hide_related: "true",
    show_user: "false",
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

let scApiPromise: Promise<SCStatic> | null = null;
function loadScApi(): Promise<SCStatic> {
  if (window.SC) return Promise.resolve(window.SC);
  if (scApiPromise) return scApiPromise;
  scApiPromise = new Promise<SCStatic>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = WIDGET_API;
    script.onload = () => (window.SC ? resolve(window.SC) : reject(new Error("SC missing")));
    script.onerror = () => reject(new Error("failed to load SoundCloud widget"));
    document.head.appendChild(script);
  });
  return scApiPromise;
}

export default function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [queueId, setQueueId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [initialUrl, setInitialUrl] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const widgetRef = useRef<SCWidget | null>(null);
  // Refs mirror state so the FINISH callback (bound once) sees live values.
  const queueRef = useRef<QueueItem[]>([]);
  const indexRef = useRef(0);

  const playAt = useCallback((i: number) => {
    const items = queueRef.current;
    if (i < 0 || i >= items.length) return;
    indexRef.current = i;
    setIndex(i);
    setProgress(0);
    if (widgetRef.current) {
      // load()'s callback fires once the new set is actually ready — only THEN is
      // play() guaranteed to take. `auto_play` alone is flaky on rapid skips and on
      // mobile, leaving the set loaded-but-paused (the "doesn't start / pause-unpause
      // a few times to get it going" bug). Driving play() from the callback is
      // deterministic. setIsPlaying optimistically so the transport reflects intent.
      setIsPlaying(true);
      widgetRef.current.load(items[i].url, {
        auto_play: true,
        callback: () => widgetRef.current?.play(),
      });
    } else {
      // No widget yet → render the iframe with this track; onLoad binds + autoplays.
      setInitialUrl(items[i].url);
    }
  }, []);

  const bindWidget = useCallback(() => {
    const SC = window.SC;
    if (!SC || !iframeRef.current) return;
    const widget = SC.Widget(iframeRef.current);
    widgetRef.current = widget;
    const E = SC.Widget.Events;
    widget.bind(E.PLAY, () => setIsPlaying(true));
    widget.bind(E.PAUSE, () => setIsPlaying(false));
    widget.bind(E.FINISH, () => {
      const nextIndex = indexRef.current + 1;
      if (nextIndex < queueRef.current.length) playAt(nextIndex);
      else setIsPlaying(false);
    });
    widget.bind(E.PLAY_PROGRESS, (e) => {
      if (e?.relativePosition != null) setProgress(e.relativePosition);
    });
  }, [playAt]);

  const playQueue = useCallback(
    (id: string, items: QueueItem[], startIndex: number) => {
      queueRef.current = items;
      setQueue(items);
      setQueueId(id);
      void loadScApi(); // ensure the script is loading
      playAt(startIndex);
    },
    [playAt],
  );

  const toggle = useCallback(() => widgetRef.current?.toggle(), []);
  const next = useCallback(() => playAt(indexRef.current + 1), [playAt]);
  const prev = useCallback(() => playAt(indexRef.current - 1), [playAt]);

  // Jump through a set like a DJ scrubbing the deck. Past the end → next DJ.
  const seekBy = useCallback(
    (seconds: number) => {
      const w = widgetRef.current;
      if (!w) return;
      w.getDuration((durationMs) => {
        w.getPosition((posMs) => {
          const target = posMs + seconds * 1000;
          if (target >= durationMs) playAt(indexRef.current + 1);
          else w.seekTo(Math.max(0, target));
        });
      });
    },
    [playAt],
  );

  // Tap the progress bar to land anywhere in the set (the mobile "jump").
  const seekToFraction = useCallback((f: number) => {
    const w = widgetRef.current;
    if (!w) return;
    const clamped = Math.max(0, Math.min(0.999, f));
    w.getDuration((durationMs) => w.seekTo(clamped * durationMs));
  }, []);

  // Desktop: J jumps forward 30s, K back 30s. Ignore while typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || !widgetRef.current) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === "j") {
        e.preventDefault();
        seekBy(30);
      } else if (k === "k") {
        e.preventDefault();
        seekBy(-30);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seekBy]);

  // When the iframe first appears, init the widget once the API is ready.
  const onIframeLoad = useCallback(() => {
    if (widgetRef.current) return;
    loadScApi().then(bindWidget).catch(() => {});
  }, [bindWidget]);

  // Keep cleanup tidy if the provider unmounts (shouldn't, it's in the layout).
  useEffect(() => () => void (widgetRef.current = null), []);

  const current = queueId ? (queue[index] ?? null) : null;

  return (
    <PlayerContext.Provider
      value={{ queueId, index, isPlaying, current, playQueue, toggle, next, prev }}
    >
      {children}

      {/* hidden audio host — persists across navigation */}
      {initialUrl && (
        <iframe
          ref={iframeRef}
          title="player"
          allow="autoplay"
          src={widgetSrc(initialUrl)}
          onLoad={onIframeLoad}
          className="pointer-events-none fixed h-0 w-0 border-0 opacity-0"
        />
      )}

      {current && <PlayerBar current={current} isPlaying={isPlaying} progress={progress} onToggle={toggle} onNext={next} onPrev={prev} onSeekBy={seekBy} onSeekFraction={seekToFraction} />}
    </PlayerContext.Provider>
  );
}

/*
 * Flat two-ink control glyphs. All icons inherit `currentColor` so a button's text
 * color is the only knob — secondary controls sit in --muted and light to --ink on
 * hover; the play/pause hero inverts to --ink on an --acid field. 24x24 viewBox,
 * geometric, no OS emoji (those were the colorful skip glyphs that broke the look).
 */
function SkipIcon({ dir }: { dir: "prev" | "next" }) {
  // Two triangles + a bar — jump to the previous/next set.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
      {dir === "next" ? (
        <>
          <path d="M5 5l8 7-8 7V5z" />
          <path d="M13 5l6 7-6 7V5z" />
          <rect x="18" y="5" width="2" height="14" />
        </>
      ) : (
        <>
          <rect x="4" y="5" width="2" height="14" />
          <path d="M19 5l-8 7 8 7V5z" />
          <path d="M11 5l-6 7 6 7V5z" />
        </>
      )}
    </svg>
  );
}

function SeekIcon({ dir }: { dir: "back" | "fwd" }) {
  // Two triangles — fast-forward / rewind 30s within the current set.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-3.5 w-3.5">
      {dir === "fwd" ? (
        <>
          <path d="M3 5l8 7-8 7V5z" />
          <path d="M12 5l8 7-8 7V5z" />
        </>
      ) : (
        <>
          <path d="M21 5l-8 7 8 7V5z" />
          <path d="M12 5l-8 7 8 7V5z" />
        </>
      )}
    </svg>
  );
}

function TransportIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
      {playing ? (
        <>
          <rect x="6" y="5" width="4" height="14" />
          <rect x="14" y="5" width="4" height="14" />
        </>
      ) : (
        <path d="M7 5l12 7-12 7V5z" />
      )}
    </svg>
  );
}

function PlayerBar({
  current,
  isPlaying,
  progress,
  onToggle,
  onNext,
  onPrev,
  onSeekBy,
  onSeekFraction,
}: {
  current: QueueItem;
  isPlaying: boolean;
  progress: number;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeekBy: (seconds: number) => void;
  onSeekFraction: (f: number) => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-paper">
      {/* acid progress — tap anywhere to jump there in the set */}
      <button
        type="button"
        aria-label="seek"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onSeekFraction((e.clientX - rect.left) / rect.width);
        }}
        className="block h-2 w-full cursor-pointer bg-line"
      >
        <div className="h-full bg-acid" style={{ width: `${Math.round(progress * 100)}%` }} />
      </button>
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        {/* ember pulse when live */}
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            isPlaying ? "bg-ember motion-safe:animate-pulse" : "bg-muted"
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold uppercase leading-none">
            {current.artist}
          </p>
          <p className="truncate font-mono text-xs text-muted">
            {current.title} · {current.durationMin}m
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            aria-label="previous set"
            className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-ink"
          >
            <SkipIcon dir="prev" />
          </button>
          <button
            type="button"
            onClick={() => onSeekBy(-30)}
            title="back 30s (K)"
            aria-label="jump back 30 seconds"
            className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-ink"
          >
            <SeekIcon dir="back" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label={isPlaying ? "pause" : "play"}
            className="flex h-9 w-9 items-center justify-center bg-acid text-ink transition-opacity hover:opacity-90"
          >
            <TransportIcon playing={isPlaying} />
          </button>
          <button
            type="button"
            onClick={() => onSeekBy(30)}
            title="jump 30s (J)"
            aria-label="jump forward 30 seconds"
            className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-ink"
          >
            <SeekIcon dir="fwd" />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="next set"
            className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-ink"
          >
            <SkipIcon dir="next" />
          </button>
        </div>
      </div>
    </div>
  );
}
