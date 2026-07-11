import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// All better-auth endpoints (sign-in, callback, session, sign-out) live under /api/auth/*.
export const runtime = "nodejs";

export const { GET, POST } = toNextJsHandler(auth);
