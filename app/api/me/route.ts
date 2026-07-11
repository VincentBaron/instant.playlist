import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBalance } from "@/lib/db";

export const runtime = "nodejs";

/** The signed-in user's live credit balance (used by the client to refresh the badge). */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ authenticated: false, credits: 0 });
  }
  const credits = await getBalance(session.user.id);
  return NextResponse.json({ authenticated: true, credits });
}
