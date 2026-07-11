import { config } from "dotenv";
config({ path: ".env.local" });

import { randomBytes } from "node:crypto";
import { addPurchaseCredits, getBalance, getUserByEmail } from "@/lib/db";

/*
 * Manual credit grant (YOL-49) — the fallback for the Buy Me a Coffee flow. Use it to
 * grant scans by hand when the webhook isn't wired yet, or when a supporter paid with an
 * email that doesn't match their account (the auto-grant join key is email).
 *
 *   tsx scripts/grant-credits.ts <email> <credits> [note]
 *
 * Each run inserts a fresh, unique ledger entry (random idempotency key) so repeated
 * manual grants are intentional, not deduped.
 */
async function main() {
  const [email, creditsArg, note] = process.argv.slice(2);
  const credits = Number(creditsArg);
  if (!email || !Number.isInteger(credits) || credits <= 0) {
    console.error("usage: tsx scripts/grant-credits.ts <email> <credits> [note]");
    process.exit(1);
  }

  const account = await getUserByEmail(email);
  if (!account) {
    console.error(`no account found for ${email}`);
    process.exit(1);
  }

  const key = `manual:${note ? `${note}:` : ""}${randomBytes(6).toString("hex")}`;
  await addPurchaseCredits(account.id, credits, key);
  const balance = await getBalance(account.id);
  console.log(`granted ${credits} credits to ${email} — new balance: ${balance}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
