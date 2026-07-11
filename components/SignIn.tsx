"use client";

import { useState } from "react";
import { emailOtp, signIn } from "@/lib/auth-client";

/*
 * Just-in-time account capture. Shown AFTER a poster is dropped, not as a homepage wall —
 * so the ask lands when intent is highest ("give us your email, here's your lineup").
 * Email one-time-code is the primary path (keeps the pending scan on this page so it can
 * auto-continue on verify); Google is offered as a secondary one-tap. `googleEnabled` is
 * passed from the server (is GOOGLE_CLIENT_ID set?) so we don't show a dead button.
 */
export default function SignIn({
  googleEnabled,
  title = "sign in to scan",
  subtitle = "3 free poster scans — no card needed",
  onCancel,
}: {
  googleEnabled: boolean;
  title?: string;
  subtitle?: string;
  onCancel?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function google() {
    setError(null);
    await signIn.social({ provider: "google", callbackURL: "/" });
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    setBusy(false);
    if (error) {
      setError(error.message ?? "couldn't send the code");
      return;
    }
    setStage("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signIn.emailOtp({ email, otp });
    setBusy(false);
    if (error) {
      setError(error.message ?? "that code didn't work");
      return;
    }
    // On success better-auth sets the session cookie; useSession re-renders and the
    // Dropzone auto-continues the pending scan.
  }

  return (
    <div className="flex flex-col gap-4 border border-line bg-white/40 p-6">
      <div className="flex flex-col gap-1">
        <p className="font-display text-2xl font-black uppercase leading-none">
          {title}
        </p>
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          {subtitle}
        </p>
      </div>

      {stage === "email" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-2">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="border border-line bg-white/60 px-3 py-2 font-mono text-sm text-ink outline-none focus:border-ink"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center bg-acid px-4 py-2 font-mono text-sm font-bold uppercase text-ink disabled:opacity-60"
          >
            {busy ? "sending…" : "email me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-2">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            autoFocus
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit code"
            className="border border-line bg-white/60 px-3 py-2 font-mono text-sm tracking-widest text-ink outline-none focus:border-ink"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center bg-acid px-4 py-2 font-mono text-sm font-bold uppercase text-ink disabled:opacity-60"
          >
            {busy ? "checking…" : "verify & get my lineup"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStage("email");
              setOtp("");
              setError(null);
            }}
            className="self-start font-mono text-xs uppercase tracking-widest text-muted underline"
          >
            use a different email
          </button>
        </form>
      )}

      {googleEnabled && (
        <button
          type="button"
          onClick={google}
          className="inline-flex items-center justify-center border border-ink px-4 py-2 font-mono text-sm font-bold uppercase text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          or continue with google
        </button>
      )}

      {error && <p className="font-mono text-xs text-ember">{error}</p>}

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="self-start font-mono text-xs uppercase tracking-widest text-muted underline"
        >
          ← back
        </button>
      )}
    </div>
  );
}
