import { createHmac, timingSafeEqual } from "node:crypto";
import { PRICE_PER_SCAN_CENTS } from "@/lib/packs";

/*
 * Buy Me a Coffee webhook helpers (server-side only). BMC signs each delivery with an
 * HMAC-SHA256 of the raw request body using your webhook secret; we verify that before
 * trusting anything. Because BMC has no per-user checkout, a purchase is matched to an
 * account by the supporter's email and converted to credits at the flat PRICE_PER_SCAN.
 *
 * The exact payload field names vary a little across BMC's event types, so parsing is
 * deliberately tolerant (several candidate keys) rather than a rigid schema.
 */

/** Header BMC uses for the HMAC signature (checked case-insensitively by req.headers). */
export const BMC_SIGNATURE_HEADER = "x-signature-sha256";

/** Constant-time compare of the delivered signature against HMAC-SHA256(secret, rawBody). */
export function verifyBmcSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  // Normalize an optional "sha256=" prefix some senders include.
  const provided = signature.replace(/^sha256=/i, "").trim().toLowerCase();
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A parsed, credit-worthy BMC purchase. */
export type BmcPurchase = {
  paymentId: string; // stable id → idempotency key
  email: string; // supporter email → account join key
  amountMajor: number; // amount paid, in major currency units (e.g. 5 = €5)
};

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function firstNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = typeof v === "string" ? Number(v) : v;
    if (typeof n === "number" && Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Pull the fields we need out of a BMC webhook body. Returns null if it isn't a
 * paid-purchase event we can act on (missing email / amount / id).
 */
export function parseBmcPurchase(payload: unknown): BmcPurchase | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;

  const email = firstString(data.supporter_email, root.supporter_email);
  const amountMajor = firstNumber(
    data.total_amount,
    data.amount,
    root.total_amount,
    root.amount,
  );
  const paymentId = firstString(
    data.transaction_id,
    data.id,
    root.event_id,
    root.transaction_id,
  );

  if (!email || amountMajor === null || amountMajor <= 0 || !paymentId) {
    return null;
  }
  return { paymentId, email, amountMajor };
}

/** Convert an amount paid (major units) into whole credits at the flat per-scan rate. */
export function creditsForAmount(amountMajor: number): number {
  return Math.floor((amountMajor * 100) / PRICE_PER_SCAN_CENTS);
}
