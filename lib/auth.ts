import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { account, session, user, verification } from "@/lib/schema";

/*
 * Server-side only. The single better-auth instance — drives the /api/auth/* handler
 * and server-side session reads (`auth.api.getSession`). Never import into a client
 * component (pulls in the DB pool + secrets); the browser uses lib/auth-client.ts.
 *
 * Sign-in methods: Google OAuth (one-tap, the mobile-first path) plus email OTP as a
 * credential-free fallback so the flow is testable without Google keys. Google is only
 * registered when its env is present, so the app still boots on OTP alone.
 *
 * Free-credit granting is deliberately NOT wired here as a create hook — it's done
 * lazily and idempotently in lib/db.ts (`ensureSignupGrant`) so a missed/duplicated
 * hook can never over- or under-grant the quota.
 */
const googleId = process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  socialProviders:
    googleId && googleSecret
      ? { google: { clientId: googleId, clientSecret: googleSecret } }
      : {},
  plugins: [
    emailOTP({
      // Delivery is handled by lib/email.ts: real provider (Resend) when configured,
      // dev log otherwise, and a hard failure in production if nothing is set up — so an
      // OTP (a bearer credential) is never silently dropped or leaked to prod logs.
      sendVerificationOTP: async ({ email, otp }) => {
        await sendEmail({
          to: email,
          subject: "Your instant.playlist sign-in code",
          text: `Your instant.playlist sign-in code is ${otp}\n\nIt expires in 5 minutes. If you didn't request this, you can ignore this email.`,
          html: `<p>Your instant.playlist sign-in code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:2px">${otp}</p><p>It expires in 5 minutes. If you didn't request this, you can ignore this email.</p>`,
        });
      },
    }),
    // Must be last: bridges better-auth's Set-Cookie into Next's cookie store so
    // sign-in/out actually persists the session cookie in Server Actions/handlers.
    nextCookies(),
  ],
});
