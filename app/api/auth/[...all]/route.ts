import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";

// All better-auth endpoints (sign-in, callback, session, sign-out) live under /api/auth/*.
export const runtime = "nodejs";

// better-auth queries the auth tables on every call (even get-session). Ensure they exist
// first, so a deploy that skipped `drizzle-kit migrate` doesn't 500 the whole auth layer.
const handlers = toNextJsHandler(auth);

export async function GET(req: Request) {
  await ensureSchema();
  return handlers.GET(req);
}

export async function POST(req: Request) {
  await ensureSchema();
  return handlers.POST(req);
}
