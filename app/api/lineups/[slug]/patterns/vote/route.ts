import { NextResponse } from "next/server";
import { z } from "zod";
import { votePattern, voterHash } from "@/lib/db";

export const runtime = "nodejs";

const VoteRequest = z.object({ patternId: z.number().int().positive() });

/** Client IP from the proxy chain (best-effort; only used to dedupe/raise the spam bar). */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "0.0.0.0";
}

/**
 * Upvote a pattern. Deduped by sha256(ip|user-agent) — paired with the client's
 * localStorage guard this is "1 vote/device + IP". Returns { ok:false } if already voted.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const parsed = VoteRequest.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "body must be { patternId }" },
        { status: 400 },
      );
    }
    const hash = voterHash(clientIp(req), req.headers.get("user-agent") ?? "");
    const result = await votePattern(slug, parsed.data.patternId, hash);
    if (result.votes === null) {
      return NextResponse.json({ error: "pattern not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error(`POST /api/lineups/${slug}/patterns/vote failed:`, err);
    return NextResponse.json({ error: "failed to vote" }, { status: 500 });
  }
}
