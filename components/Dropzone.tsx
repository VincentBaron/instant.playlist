"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUpload } from "@/components/upload/UploadProvider";

export default function Dropzone() {
  const { state, startUpload } = useUpload();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = state.kind === "uploading";

  // Vision (the fast part) runs here; once it kicks off the background resolve, this
  // frees up immediately — the global upload pill (see UploadProvider) tracks the rest.
  const scan = useCallback(
    (file: File) => {
      if (busy) return;
      void startUpload(file);
    },
    [busy, startUpload],
  );

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
          {busy ? (
            "this can take a moment"
          ) : (
            <>
              {/* Touch devices can't drop/paste — swap wording via pure CSS so the
                  server and client render identical HTML (no hydration mismatch). */}
              <span className="pointer-coarse:hidden">tap, drop, or paste</span>
              <span className="hidden pointer-coarse:inline">or tap to choose</span>
              {" · jpeg, png, heic"}
            </>
          )}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={onPick}
      />

      {state.kind === "error" && (
        <p className="font-mono text-xs text-ember">{state.message}</p>
      )}
    </div>
  );
}
