/**
 * Real outbound contact form delivery. No provider configured → not active (no fake send).
 * Uses Resend HTTP API; set RESEND_API_KEY, RESEND_FROM_EMAIL, CONTACT_INBOX_TO.
 */

export function isContactEmailDeliveryConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() &&
      process.env.RESEND_FROM_EMAIL?.trim() &&
      process.env.CONTACT_INBOX_TO?.trim()
  );
}

export type ContactDeliveryResult = { ok: true } | { ok: false; code: "not_configured" | "provider_error" };

export async function sendContactInquiry(input: {
  name: string;
  email: string;
  message: string;
  /** When set (e.g. /support form), included in Resend subject line and body. */
  subject?: string;
}): Promise<ContactDeliveryResult> {
  if (!isContactEmailDeliveryConfigured()) {
    return { ok: false, code: "not_configured" };
  }
  const key = process.env.RESEND_API_KEY!.trim();
  const from = process.env.RESEND_FROM_EMAIL!.trim();
  const to = process.env.CONTACT_INBOX_TO!.trim();
  const topic = input.subject?.trim();
  const subject = topic
    ? `[PrivacyEraser contact] ${topic} — ${input.name}`
    : `[PrivacyEraser contact] ${input.name}`;
  const bodyText = topic
    ? `Subject: ${topic}\n\nFrom: ${input.name} <${input.email}>\n\n${input.message}`
    : `From: ${input.name} <${input.email}>\n\n${input.message}`;

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: input.email,
        subject,
        text: bodyText
      })
    });
  } catch {
    return { ok: false, code: "provider_error" };
  }
  if (!res.ok) {
    return { ok: false, code: "provider_error" };
  }
  return { ok: true };
}
