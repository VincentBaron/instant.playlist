import { NextResponse } from "next/server";
import { addPurchaseCredits, getUserByEmail } from "@/lib/db";
import {
  BMC_SIGNATURE_HEADER,
  creditsForAmount,
  parseBmcPurchase,
  verifyBmcSignature,
} from "@/lib/bmc";

// Needs the RAW request body for HMAC verification — Node runtime, read via req.text().
export const runtime = "nodejs";

/**
 * Buy Me a Coffee webhook → grant credits on a paid support/purchase. Flow:
 *   verify HMAC signature → parse (email, amount, paymentId) → match account by email →
 *   grant floor(amount / price-per-scan) credits, idempotent on 'bmc:<paymentId>'.
 *
 * Always returns 2xx for events we understood but can't act on (e.g. no account matches
 * the payer's email) so BMC doesn't retry forever — those are logged for a manual grant
 * via scripts/grant-credits.ts. Non-2xx is reserved for "please retry" (transient errors).
 */
export async function POST(req: Request) {
  const secret = process.env.BMC_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not configured" }, { status: 400 });
  }

  const raw = await req.text();
  const signature = req.headers.get(BMC_SIGNATURE_HEADER);
  if (!verifyBmcSignature(raw, signature, secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const purchase = parseBmcPurchase(payload);
  if (!purchase) {
    // Not a purchase we credit (e.g. a cancellation, or missing fields) — ack, don't retry.
    return NextResponse.json({ received: true, granted: false });
  }

  const credits = creditsForAmount(purchase.amountMajor);
  if (credits <= 0) {
    return NextResponse.json({ received: true, granted: false });
  }

  try {
    const account = await getUserByEmail(purchase.email);
    if (!account) {
      // Payer's email doesn't match any account — grant manually with scripts/grant-credits.ts.
      console.warn(
        `[bmc] unmatched purchase: ${purchase.email} paid for ${credits} credits (payment ${purchase.paymentId})`,
      );
      return NextResponse.json({ received: true, granted: false });
    }
    await addPurchaseCredits(account.id, credits, `bmc:${purchase.paymentId}`);
    return NextResponse.json({ received: true, granted: true });
  } catch (err) {
    // Transient DB failure → 500 so BMC retries the (idempotent) delivery.
    console.error("[bmc] granting credits failed:", err);
    return NextResponse.json({ error: "grant failed" }, { status: 500 });
  }
}
