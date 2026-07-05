import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Minimal event sink — logs to stdout. No analytics vendor wired up yet. */
export async function POST(req: Request) {
  try {
    const { event } = await req.json();
    if (typeof event !== "string" || !event) {
      return NextResponse.json({ error: "missing event" }, { status: 400 });
    }
    console.log(`event: ${event}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/events failed:", err);
    return NextResponse.json({ error: "failed to record event" }, { status: 500 });
  }
}
