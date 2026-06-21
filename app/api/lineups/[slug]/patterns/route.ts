import { NextResponse } from "next/server";
import { z } from "zod";
import { createPattern, getLineupBySlug, listPatterns } from "@/lib/db";
import { sanitizePattern } from "@/lib/themes";

export const runtime = "nodejs";

/** List the live patterns for a lineup (public — no secret tokens). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    return NextResponse.json({ patterns: await listPatterns(slug) });
  } catch (err) {
    console.error(`GET /api/lineups/${slug}/patterns failed:`, err);
    return NextResponse.json({ error: "failed to load patterns" }, { status: 500 });
  }
}

// A submission is just curated colors; sanitizePattern re-checks them against the
// whitelist server-side, so a posted pattern is always legible and abuse-proof.
const PatternRequest = z.object({
  from: z.string(),
  to: z.string(),
  accent: z.string(),
  grain: z.number().optional(),
});

/** Post a new pattern. Returns the created pattern WITH its secret token + private link. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const lineup = await getLineupBySlug(slug);
    if (!lineup) {
      return NextResponse.json({ error: "lineup not found" }, { status: 404 });
    }

    const parsed = PatternRequest.safeParse(await req.json().catch(() => null));
    const clean = parsed.success ? sanitizePattern(parsed.data) : null;
    if (!clean) {
      return NextResponse.json(
        { error: "pattern must use the provided colors" },
        { status: 400 },
      );
    }

    const pattern = await createPattern(slug, clean);
    return NextResponse.json(
      { pattern, link: `/p/${pattern.token}` },
      { status: 201 },
    );
  } catch (err) {
    console.error(`POST /api/lineups/${slug}/patterns failed:`, err);
    return NextResponse.json({ error: "failed to post pattern" }, { status: 500 });
  }
}
