"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

/*
 * Browser-side auth. Same-origin, so no baseURL needed. Exposes the hooks/actions the
 * UI uses: `useSession`, `signIn.social`, `signIn.emailOtp`, `emailOtp.sendVerificationOtp`,
 * and `signOut`. Never import lib/auth.ts (server) into a client component.
 */
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});

export const { useSession, signIn, signOut, emailOtp } = authClient;
