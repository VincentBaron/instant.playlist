/*
 * The credit-pack catalog — pure data, safe to import from client components (no secrets).
 * Single source of truth for the credits↔price mapping so the paywall copy and the
 * Buy Me a Coffee webhook grant can never disagree. 1 credit = 1 poster scan.
 *
 * BMC has no per-user checkout, so purchases are granted by a flat rate (below): the
 * webhook converts the amount paid into credits at PRICE_PER_SCAN. Packs are therefore
 * just suggested round amounts at that same rate — no tiered discount to reconcile.
 */

/** Flat price of one scan, in cents of CURRENCY. Env-overridable for quick tuning. */
export const PRICE_PER_SCAN_CENTS = Math.max(
  1,
  Math.round(Number(process.env.NEXT_PUBLIC_PRICE_PER_SCAN_CENTS ?? 50) || 50),
);

export const CURRENCY = "eur";

export type CreditPack = {
  id: string;
  credits: number;
  priceCents: number; // always credits × PRICE_PER_SCAN_CENTS (kept consistent by construction)
  label: string;
};

function pack(id: string, credits: number, label: string): CreditPack {
  return { id, credits, priceCents: credits * PRICE_PER_SCAN_CENTS, label };
}

export const CREDIT_PACKS: readonly CreditPack[] = [
  pack("starter", 10, "Starter"),
  pack("regular", 50, "Regular"),
  pack("pro", 150, "Pro"),
];

export function packById(id: string): CreditPack | null {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null;
}

/** The public Buy Me a Coffee page URL (client-safe; NEXT_PUBLIC_ is inlined at build). */
export function bmcUrl(): string | null {
  return process.env.NEXT_PUBLIC_BMC_URL ?? null;
}

/** e.g. 500 → "€5", 250 → "€2.50". */
export function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
