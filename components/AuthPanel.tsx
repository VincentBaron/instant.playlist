"use client";

import { signOut, useSession } from "@/lib/auth-client";

/*
 * Header identity strip: shows who's signed in + a sign-out affordance. Signed-out state
 * renders nothing — the Dropzone owns the sign-in call to action so there's one clear
 * entry point.
 */
export default function AuthPanel() {
  const { data: session, isPending } = useSession();
  if (isPending || !session) return null;

  return (
    <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-muted">
      <span className="truncate">{session.user.email}</span>
      <button
        type="button"
        onClick={() => signOut()}
        className="underline transition-colors hover:text-ember"
      >
        sign out
      </button>
    </div>
  );
}
