import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fulfillLifetimeEntitlement } from "@/lib/fulfillment/lifetime-entitlement";
import { verifyPaddleSignature } from "@/lib/paddle-signature";
import { ensurePendingReferralForBuyer, recordReferralConversion } from "@/lib/affiliate-referral";
import { sendLifetimeWelcomeEmail } from "@/lib/email";
import { emitServerEvent } from "@/lib/events/event-emitter";
import {
  getEmailFromPaddleData,
  getPublicScanIdFromPaddleData,
  getTransactionIdFromPaddleData
} from "@/lib/paddle-transaction-data";
import { safeDbResult } from "@/lib/safe-db";
import { getUsdAmountCentsFromPaddleData } from "@/lib/paddle-amount";
import { nukeUserByEmail } from "@/services/remover";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HANDLED: ReadonlySet<string> = new Set(["transaction.completed", "subscription.created"]);

export async function POST(request: Request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, state: "PADDLE_WEBHOOK_NOT_ACTIVE", detail: "PADDLE_WEBHOOK_SECRET is not set" },
      { status: 200 }
    );
  }

  const rawBody = await request.text();
  const sig =
    request.headers.get("Paddle-Signature") ||
    request.headers.get("paddle-signature") ||
    null;

  if (!verifyPaddleSignature(rawBody, sig, secret)) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  let payload: { event_id?: string; event_type?: string; data?: unknown };
  try {
    payload = JSON.parse(rawBody) as { event_id?: string; event_type?: string; data?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const eventId = typeof payload.event_id === "string" ? payload.event_id : null;
  const eventType = typeof payload.event_type === "string" ? payload.event_type : null;

  if (eventId) {
    const seenRes = await safeDbResult(() => prisma.processedPaddleEvent.findUnique({ where: { eventId } }));
    if (seenRes.ok) {
      if (seenRes.value) {
        return NextResponse.json({ ok: true, deduped: true });
      }
    }
  }

  if (!eventType || !HANDLED.has(eventType) || !payload.data) {
    if (eventId) {
      void safeDbResult(() => prisma.processedPaddleEvent.create({ data: { eventId } }));
    }
    return NextResponse.json({ ok: true, ignored: true, eventType });
  }

  const data = payload.data;
  const transactionId = getTransactionIdFromPaddleData(data);
  const email = getEmailFromPaddleData(data);
  const publicScanId = getPublicScanIdFromPaddleData(data);
  const amountCents = getUsdAmountCentsFromPaddleData(data);

  if (!email) {
    console.error("[webhooks/paddle] missing email", { eventType });
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 422 });
  }

  try {
    await fulfillLifetimeEntitlement({
      email,
      linkPublicScanId: publicScanId,
      paddleTransactionId: transactionId ?? eventId
    });
    await ensurePendingReferralForBuyer(email);
    const conversionAudit = await recordReferralConversion({
      email,
      paymentEventId: eventId ?? undefined,
      paymentTransactionId: transactionId ?? eventId ?? undefined
    });
    void emitServerEvent({
      event: "affiliate_commission_audit",
      payload: {
        provider: "paddle",
        webhookEventType: eventType,
        webhookEventId: eventId ?? "",
        transactionId: transactionId ?? "",
        buyerEmail: email,
        audit: conversionAudit
      }
    });
    void sendLifetimeWelcomeEmail(email);

    // Auto-Remover: trigger takedown requests for $149/$199 payments only.
    // Runs best-effort and should not break webhook fulfillment.
    if (eventType === "transaction.completed" && (amountCents === 14900 || amountCents === 19900)) {
      void nukeUserByEmail({ userEmail: email, scanId: publicScanId ?? null }).catch((e) => {
        console.error("[webhooks/paddle] nuke_failed", e);
      });
    }
    if (eventId) {
      void safeDbResult(() => prisma.processedPaddleEvent.create({ data: { eventId } }));
    }
  } catch (e) {
    const code = e instanceof Error ? e.message : "fulfill_failed";
    console.error("[webhooks/paddle] fulfill", e);
    if (code === "scan_attached_to_other_user" || code === "email_mismatch_with_scan") {
      return NextResponse.json({ ok: false, error: code }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: "fulfill_failed", message: "Could not apply entitlement. Will retry from dashboard if needed." },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true });
}
