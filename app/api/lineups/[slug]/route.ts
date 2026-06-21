import { NextResponse } from "next/server";
import { z } from "zod";
import { getLineupBySlug, updateLineupSchedule } from "@/lib/db";

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

// Crowd-sourced schedule edits. Anonymous + unmoderated in MVP (matches the public,
// no-signup product). Time must be 24h "HH:MM"; day is a short free-form label.
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ScheduleRequest = z.object({
  edits: z
    .array(
      z.object({
        index: z.number().int().nonnegative(),
        setTime: z.string().regex(TIME_RE, "time must be HH:MM").nullable(),
        setDay: z.string().trim().min(1).max(24).nullable(),
      }),
    )
    .min(1)
    .max(500),
});

/** Update set times/days for a lineup. Next 16: params is a Promise. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const parsed = ScheduleRequest.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "body must be { edits: [{ index, setTime, setDay }] }" },
        { status: 400 },
      );
    }
    const lineup = await updateLineupSchedule(slug, parsed.data.edits);
    if (!lineup) {
      return NextResponse.json({ error: "lineup not found" }, { status: 404 });
    }
    return NextResponse.json({ lineup });
  } catch (err) {
    console.error(`PATCH /api/lineups/${slug} failed:`, err);
    return NextResponse.json({ error: "failed to update lineup" }, { status: 500 });
  }
}
