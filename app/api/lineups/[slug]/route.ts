import { NextResponse } from "next/server";
import { getLineupBySlug } from "@/lib/db";

export const runtime = "nodejs";

/** Public read for one lineup by slug. Next 16: params is a Promise. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const lineup = await getLineupBySlug(slug);
    if (!lineup) {
      return NextResponse.json({ error: "lineup not found" }, { status: 404 });
    }
    return NextResponse.json({ lineup });
  } catch (err) {
    console.error(`GET /api/lineups/${slug} failed:`, err);
    return NextResponse.json({ error: "failed to load lineup" }, { status: 500 });
  }
}
