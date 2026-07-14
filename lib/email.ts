/*
 * Transactional email (server-side only). A single sender, used by better-auth's email-OTP
 * sign-in. Delivery is pluggable via env so the feature is production-ready without a code
 * change and without adding an SDK dependency:
 *
 *   - RESEND_API_KEY + EMAIL_FROM set  → send via Resend's HTTP API (fetch).
 *   - otherwise, in development        → log the message to stdout (flow stays testable).
 *   - otherwise, in production         → throw, so an OTP never silently fails to send
 *                                        (and a bearer code never leaks to prod logs).
 *
 * Swapping Resend for SMTP/SES later is a one-function change here — callers are unaffected.
 */
type SendArgs = { to: string; subject: string; text: string; html?: string };

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: SendArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (apiKey && from) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text, html: html ?? text }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`email send failed (${res.status}): ${detail.slice(0, 200)}`);
    }
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "no email transport configured — set RESEND_API_KEY and EMAIL_FROM",
    );
  }

  // Dev fallback: print so the sign-in flow is exercisable locally without a provider.
  console.log(`[email:dev] to=${to} · ${subject}\n${text}`);
}
