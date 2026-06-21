"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LineupRecord } from "@/types";

const MAX_BYTES = 8 * 1024 * 1024;

type Status =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "done"; lineup: LineupRecord }
  | { kind: "error"; message: string };

export default function Dropzone() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  // Touch devices can't drop/paste — swap the hint wording. Detected after mount
  // so the first client paint matches the server (desktop wording) and React
  // doesn't flag a hydration mismatch. Default false → SSR-safe.
  const [touch, setTouch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scanningRef = useRef(false); // guards against concurrent paste/drop/pick
  const busy = status.kind === "scanning";

  useEffect(() => {
    // Intentional post-hydration sync (see note above): SSR can't read matchMedia.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const scan = useCallback(async (file: File) => {
    if (scanningRef.current) return;
    if (file.size > MAX_BYTES) {
      setStatus({ kind: "error", message: "that image is over 8MB — try a smaller one" });
      return;
    }
    scanningRef.current = true;
    setStatus({ kind: "scanning" });
    try {
      const body = new FormData();
      body.append("poster", file);
      const res = await fetch("/api/playlist", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error ?? "something went wrong" });
        return;
      }
      setStatus({ kind: "done", lineup: data.lineup });
    } catch {
      setStatus({ kind: "error", message: "couldn't reach the server" });
    } finally {
      scanningRef.current = false;
    }
  }, []);

  // Paste a poster screenshot straight in (Cmd/Ctrl+V) — anywhere on the page.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            scan(file);
            return;
          }
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [scan]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) scan(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) scan(file);
  }

  if (status.kind === "done") {
    const l = status.lineup;
    return (
      <div className="flex flex-col gap-4 border border-line bg-white/40 p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          scanned · {l.artistCount} artists · {l.playableCount} playable
        </p>
        <p className="font-display text-3xl font-black uppercase leading-none">
          {l.festival ?? l.title}
        </p>
        <div className="flex items-center gap-4">
          <Link
            href={`/${l.slug}`}
            className="inline-flex items-center bg-acid px-4 py-2 font-mono text-sm font-bold uppercase text-ink"
          >
            ▶ open lineup
          </Link>
          <button
            type="button"
            onClick={() => setStatus({ kind: "idle" })}
            className="font-mono text-xs uppercase tracking-widest text-muted underline"
          >
            scan another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-44 flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-acid bg-acid/10" : "border-line bg-white/30"
        } ${busy ? "opacity-60" : ""}`}
      >
        <span className="font-display text-2xl font-black uppercase leading-none">
          {busy ? "reading the poster…" : "drop a festival poster"}
        </span>
        <span className="font-mono text-xs uppercase tracking-widest text-muted">
          {busy
            ? "this can take a moment"
            : `${touch ? "or tap to choose" : "tap, drop, or paste"} · jpeg, png, heic`}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={onPick}
      />

      {status.kind === "error" && (
        <p className="font-mono text-xs text-ember">{status.message}</p>
      )}
    </div>
  );
}
