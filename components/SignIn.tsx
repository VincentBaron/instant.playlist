"use client";

import { useState } from "react";
import { emailOtp, signIn } from "@/lib/auth-client";

/*
 * Sign-in card. Google OAuth one-tap (the mobile-first path) plus an email one-time-code
 * fallback so the flow works without Google keys. `googleEnabled` is passed from the
 * server (is GOOGLE_CLIENT_ID set?) so we don't show a button that can't work.
 */
export default function SignIn({ googleEnabled }: { googleEnabled: boolean }) {
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
    // On success better-auth sets the session cookie; useSession re-renders the app.
  }

  return (
    <div className="flex flex-col gap-4 border border-line bg-white/40 p-6">
      <div className="flex flex-col gap-1">
        <p className="font-display text-2xl font-black uppercase leading-none">
          sign in to scan
        </p>
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          3 free poster scans — no card needed
        </p>
      </div>

      {googleEnabled && (
        <button
          type="button"
          onClick={google}
          className="inline-flex items-center justify-center bg-ink px-4 py-3 font-mono text-sm font-bold uppercase text-paper transition-opacity hover:opacity-90"
        >
          continue with google
        </button>
      )}

      {stage === "email" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="border border-line bg-white/60 px-3 py-2 font-mono text-sm text-ink outline-none focus:border-ink"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center border border-ink px-4 py-2 font-mono text-sm font-bold uppercase text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-60"
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
            {busy ? "checking…" : "verify & sign in"}
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

      {error && <p className="font-mono text-xs text-ember">{error}</p>}
    </div>
  );
}
