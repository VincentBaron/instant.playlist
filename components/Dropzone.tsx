"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LineupRecord } from "@/types";
import { useSession } from "@/lib/auth-client";
import Paywall from "@/components/Paywall";
import SignIn from "@/components/SignIn";

const MAX_BYTES = 8 * 1024 * 1024;

type Status =
  | { kind: "idle" }
  | { kind: "auth" } // poster captured, awaiting a quick email/account before the scan
  | { kind: "scanning" }
  | { kind: "done"; lineup: LineupRecord }
  | { kind: "paywall"; message?: string }
  | { kind: "error"; message: string };

export default function Dropzone({ googleEnabled }: { googleEnabled: boolean }) {
  const { data: session } = useSession();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [credits, setCredits] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scanningRef = useRef(false); // guards against concurrent paste/drop/pick
  // A poster picked while signed-out waits here until the account is created, then the
  // effect below auto-continues the scan — so the drop is never lost to the sign-in step.
  const pendingFileRef = useRef<File | null>(null);
  const busy = status.kind === "scanning";
  const signedIn = !!session;

  const refreshCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/me");
      const data = await res.json();
      if (data.authenticated) setCredits(data.credits);
    } catch {
      /* non-fatal: the badge just won't show */
    }
  }, []);

  useEffect(() => {
    // Load the balance once we know the user is signed in. refreshCredits only setState()s
    // after an async fetch resolves (not synchronously), so this can't cascade-render.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch, not a sync setState
    if (signedIn) refreshCredits();
  }, [signedIn, refreshCredits]);

  // Buy Me a Coffee opens in a new tab; coming back to this one re-reads the balance so a
  // just-granted purchase shows up without a manual refresh.
  useEffect(() => {
    if (!signedIn) return;
    function onFocus() {
      if (document.visibilityState === "visible") refreshCredits();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [signedIn, refreshCredits]);

  const runScan = useCallback(async (file: File) => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setStatus({ kind: "scanning" });
    try {
      const body = new FormData();
      body.append("poster", file);
      const res = await fetch("/api/playlist", { method: "POST", body });
      const data = await res.json();
      if (res.status === 402) {
        setStatus({ kind: "paywall" });
        return;
      }
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error ?? "something went wrong" });
        return;
      }
      if (typeof data.credits === "number") setCredits(data.credits);
      setStatus({ kind: "done", lineup: data.lineup });
    } catch {
      setStatus({ kind: "error", message: "couldn't reach the server" });
    } finally {
      scanningRef.current = false;
    }
  }, []);

  // A poster was chosen. If signed in, scan now; otherwise stash it and ask for an email —
  // the account capture happens at peak intent, not as a homepage wall.
  const onFile = useCallback(
    (file: File) => {
      if (file.size > MAX_BYTES) {
        setStatus({ kind: "error", message: "that image is over 8MB — try a smaller one" });
        return;
      }
      if (signedIn) {
        runScan(file);
        return;
      }
      pendingFileRef.current = file;
      setStatus({ kind: "auth" });
    },
    [signedIn, runScan],
  );

  // Once signed in with a poster waiting (email verified, or the session just resolved),
  // continue the scan automatically — no need to re-drop.
  useEffect(() => {
    if (signedIn && pendingFileRef.current) {
      const file = pendingFileRef.current;
      pendingFileRef.current = null;
      runScan(file);
    }
  }, [signedIn, runScan]);

  // Paste a poster screenshot straight in (Cmd/Ctrl+V) — anywhere on the page, signed in or not.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            onFile(file);
            return;
          }
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFile]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  // Poster captured → quick email capture before the scan runs.
  if (status.kind === "auth") {
    return (
      <SignIn
        googleEnabled={googleEnabled}
        title="almost there"
        subtitle="enter your email to unlock your lineup — 3 free scans"
        onCancel={() => {
          pendingFileRef.current = null;
          setStatus({ kind: "idle" });
        }}
      />
    );
  }

  if (status.kind === "paywall") {
    return <Paywall message={status.message} />;
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
      {signedIn && credits !== null && (
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          {credits > 0 ? (
            <>
              <span className="text-ink">{credits}</span> scan
              {credits === 1 ? "" : "s"} left
            </>
          ) : (
            <span className="text-ember">no scans left — buy credits below</span>
          )}
        </p>
      )}

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

      {status.kind === "error" && (
        <p className="font-mono text-xs text-ember">{status.message}</p>
      )}

      {signedIn && credits === 0 && <Paywall />}
    </div>
  );
}
