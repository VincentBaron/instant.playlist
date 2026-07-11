import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/lib/db";
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
      // MVP has no email transport wired. We log the code to stdout so the flow is
      // exercisable in dev ONLY — an OTP is a bearer auth credential, so it must never
      // hit logs in production. Replace this with a real email sender before launch.
      // (Google OAuth needs no code path here.)
      sendVerificationOTP: async ({ email, otp }) => {
        if (process.env.NODE_ENV === "production") {
          console.error(
            `[auth] no email transport configured — cannot deliver OTP to ${email}`,
          );
          throw new Error("email delivery is not configured");
        }
        console.log(`[auth] email OTP for ${email}: ${otp}`);
      },
    }),
    // Must be last: bridges better-auth's Set-Cookie into Next's cookie store so
    // sign-in/out actually persists the session cookie in Server Actions/handlers.
    nextCookies(),
  ],
});
