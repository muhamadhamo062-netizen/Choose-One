import { NextResponse } from "next/server";
import { isContactEmailDeliveryConfigured, sendContactInquiry } from "@/lib/contact-delivery";

export const dynamic = "force-dynamic";

type Body = { name?: string; email?: string; message?: string; subject?: string };

/**
 * Real contact delivery when Resend + inbox are configured. Otherwise 503 so the UI can show the direct-email fallback.
 */
export async function POST(request: Request) {
  if (!isContactEmailDeliveryConfigured()) {
    return NextResponse.json(
      { ok: false, code: "contact_delivery_not_configured", state: "EMAIL_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const subjectRaw = typeof body.subject === "string" ? body.subject.trim() : "";
  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json({ ok: false, error: "message_too_short" }, { status: 400 });
  }

  let subject: string | undefined;
  if (subjectRaw.length > 0) {
    if (subjectRaw.length < 3) {
      return NextResponse.json({ ok: false, error: "subject_too_short" }, { status: 400 });
    }
    if (subjectRaw.length > 200) {
      return NextResponse.json({ ok: false, error: "subject_too_long" }, { status: 400 });
    }
    subject = subjectRaw;
  }

  const out = await sendContactInquiry({ name, email, message, subject });
  if (!out.ok) {
    if (out.code === "not_configured") {
      return NextResponse.json(
        { ok: false, code: "contact_delivery_not_configured", state: "EMAIL_NOT_CONFIGURED" },
        { status: 503 }
      );
    }
    return NextResponse.json({ ok: false, code: "contact_send_failed" }, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}
