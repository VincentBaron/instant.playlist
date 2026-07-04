"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { LineupRecord } from "@/types";

/*
 * Mounted ONCE in the root layout, next to PlayerProvider — a poster upload survives
 * navigation the same way audio does. Dropzone kicks off startUpload() and forgets;
 * this provider polls the lineup while it's "processing" (SoundCloud resolution
 * running server-side, see app/api/playlist/route.ts) and renders a fixed status pill
 * on every page so scanning a poster never blocks browsing elsewhere.
 */
type UploadState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "processing"; slug: string; name: string }
  | { kind: "ready"; slug: string; name: string }
  | { kind: "error"; message: string };

type UploadContextValue = {
  state: UploadState;
  startUpload: (file: File) => Promise<void>;
  dismiss: () => void;
};

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUpload(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used within <UploadProvider>");
  return ctx;
}

const MAX_BYTES = 8 * 1024 * 1024;
const POLL_MS = 3000;

export default function UploadProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const uploadingRef = useRef(false); // guards concurrent paste/drop/pick
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const watch = useCallback(
    (slug: string, name: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/lineups/${slug}`, { cache: "no-store" });
          if (!res.ok) return;
          const data: { lineup: LineupRecord } = await res.json();
          if (data.lineup.status === "ready") {
            stopPolling();
            setState({ kind: "ready", slug, name });
          } else if (data.lineup.status === "error") {
            stopPolling();
            setState({
              kind: "error",
              message: "couldn't resolve some sets — open the lineup to see what came through",
            });
          }
        } catch {
          // transient network hiccup — next tick retries
        }
      }, POLL_MS);
    },
    [stopPolling],
  );

  const startUpload = useCallback(
    async (file: File) => {
      if (uploadingRef.current) return;
      if (file.size > MAX_BYTES) {
        setState({ kind: "error", message: "that image is over 8MB — try a smaller one" });
        return;
      }
      uploadingRef.current = true;
      stopPolling();
      setState({ kind: "uploading" });
      try {
        const body = new FormData();
        body.append("poster", file);
        const res = await fetch("/api/playlist", { method: "POST", body });
        const data = await res.json();
        if (!res.ok) {
          setState({ kind: "error", message: data.error ?? "something went wrong" });
          return;
        }
        const lineup: LineupRecord = data.lineup;
        const name = lineup.festival ?? lineup.title;
        if (lineup.status === "processing") {
          setState({ kind: "processing", slug: lineup.slug, name });
          watch(lineup.slug, name);
        } else {
          setState({ kind: "ready", slug: lineup.slug, name });
        }
      } catch {
        setState({ kind: "error", message: "couldn't reach the server" });
      } finally {
        uploadingRef.current = false;
      }
    },
    [stopPolling, watch],
  );

  const dismiss = useCallback(() => {
    stopPolling();
    setState({ kind: "idle" });
  }, [stopPolling]);

  return (
    <UploadContext.Provider value={{ state, startUpload, dismiss }}>
      {children}
      <UploadIndicator state={state} onDismiss={dismiss} />
    </UploadContext.Provider>
  );
}

function UploadIndicator({
  state,
  onDismiss,
}: {
  state: UploadState;
  onDismiss: () => void;
}) {
  if (state.kind === "idle") return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex max-w-xs items-start gap-3 border border-line bg-paper px-4 py-3 shadow-lg">
      {(state.kind === "uploading" || state.kind === "processing") && (
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-ember motion-safe:animate-pulse" />
      )}
      <div className="min-w-0 flex-1">
        {state.kind === "uploading" && (
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            reading the poster…
          </p>
        )}
        {state.kind === "processing" && (
          <>
            <p className="truncate font-display text-sm font-bold uppercase leading-none">
              {state.name}
            </p>
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">
              resolving sets… browse away, we&apos;ll keep going
            </p>
          </>
        )}
        {state.kind === "ready" && (
          <>
            <p className="truncate font-display text-sm font-bold uppercase leading-none">
              {state.name}
            </p>
            <Link
              href={`/${state.slug}`}
              onClick={onDismiss}
              className="mt-1 inline-block font-mono text-xs uppercase tracking-widest text-ink underline decoration-acid decoration-2 underline-offset-2"
            >
              ▶ ready — open lineup
            </Link>
          </>
        )}
        {state.kind === "error" && (
          <p className="font-mono text-xs text-ember">{state.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="dismiss"
        className="shrink-0 font-mono text-xs text-muted hover:text-ink"
      >
        ✕
      </button>
    </div>
  );
}
