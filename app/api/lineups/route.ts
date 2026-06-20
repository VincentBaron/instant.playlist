import { NextResponse } from "next/server";
import { listLineups } from "@/lib/db";

export const runtime = "nodejs";

/** Public index of recent lineups (newest first, no artists blob). */
export async function GET() {
  try {
    const lineups = await listLineups();
    return NextResponse.json({ lineups });
  } catch (err) {
    console.error("GET /api/lineups failed:", err);
    return NextResponse.json({ error: "failed to list lineups" }, { status: 500 });
  }
}
