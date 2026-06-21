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
  toggle(): void;
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
      widgetRef.current.load(items[i].url, { auto_play: true });
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

      {current && <PlayerBar current={current} isPlaying={isPlaying} progress={progress} onToggle={toggle} onNext={next} onPrev={prev} />}
    </PlayerContext.Provider>
  );
}

function PlayerBar({
  current,
  isPlaying,
  progress,
  onToggle,
  onNext,
  onPrev,
}: {
  current: QueueItem;
  isPlaying: boolean;
  progress: number;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-paper">
      {/* acid progress */}
      <div className="h-0.5 w-full bg-line">
        <div className="h-full bg-acid" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
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
        <button type="button" onClick={onPrev} className="font-mono text-sm text-muted" aria-label="previous">
          ⏮
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label={isPlaying ? "pause" : "play"}
          className="flex h-9 w-9 items-center justify-center bg-acid font-mono text-sm text-ink"
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button type="button" onClick={onNext} className="font-mono text-sm text-muted" aria-label="next">
          ⏭
        </button>
      </div>
    </div>
  );
}
