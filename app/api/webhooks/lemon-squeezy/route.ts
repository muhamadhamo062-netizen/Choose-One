import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fulfillLifetimeEntitlement } from "@/lib/billing/lifetime-entitlement";
import { verifyLemonSqueezySignature } from "@/lib/billing/lemon-squeezy-signature";
import {
  getEmailFromLemonSqueezyPayload,
  getLemonSqueezyEventId,
  getLemonSqueezyEventName,
  getOrderIdFromLemonSqueezyPayload,
  getPublicScanIdFromLemonSqueezyPayload,
  getUsdAmountCentsFromLemonSqueezyPayload
} from "@/lib/billing/lemon-squeezy-webhook-data";
import { ensurePendingReferralForBuyer, recordReferralConversion } from "@/lib/affiliate-referral";
import { sendLifetimeWelcomeEmail } from "@/lib/email";
import { emitServerEvent } from "@/lib/events/event-emitter";
import { safeDbResult } from "@/lib/safe-db";
import { nukeUserByEmail } from "@/services/remover";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HANDLED = new Set(["order_created", "subscription_created", "subscription_payment_success"]);

export async function POST(request: Request) {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, state: "LEMON_SQUEEZY_WEBHOOK_NOT_ACTIVE", detail: "LEMON_SQUEEZY_WEBHOOK_SECRET is not set" },
      { status: 200 }
    );
  }

  const rawBody = await request.text();
  const sig = request.headers.get("X-Signature") || request.headers.get("x-signature");

  if (!verifyLemonSqueezySignature(rawBody, sig, secret)) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const eventName = getLemonSqueezyEventName(payload);
  const eventId = getLemonSqueezyEventId(payload);

  if (eventId) {
    const seenRes = await safeDbResult(() => prisma.processedPaddleEvent.findUnique({ where: { eventId } }));
    if (seenRes.ok && seenRes.value) {
      return NextResponse.json({ ok: true, deduped: true });
    }
  }

  if (!eventName || !HANDLED.has(eventName)) {
    if (eventId) {
      void safeDbResult(() => prisma.processedPaddleEvent.create({ data: { eventId } }));
    }
    return NextResponse.json({ ok: true, ignored: true, eventName });
  }

  const orderId = getOrderIdFromLemonSqueezyPayload(payload);
  const email = getEmailFromLemonSqueezyPayload(payload);
  const publicScanId = getPublicScanIdFromLemonSqueezyPayload(payload);
  const amountCents = getUsdAmountCentsFromLemonSqueezyPayload(payload);

  if (!email) {
    console.error("[webhooks/lemon-squeezy] missing email", { eventName });
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 422 });
  }

  try {
    await fulfillLifetimeEntitlement({
      email,
      linkPublicScanId: publicScanId,
      billingOrderId: orderId ?? eventId
    });
    await ensurePendingReferralForBuyer(email);
    const conversionAudit = await recordReferralConversion({
      email,
      paymentEventId: eventId ?? undefined,
      paymentTransactionId: orderId ?? eventId ?? undefined
    });
    void emitServerEvent({
      event: "affiliate_commission_audit",
      payload: {
        provider: "lemon_squeezy",
        webhookEventType: eventName,
        webhookEventId: eventId ?? "",
        orderId: orderId ?? "",
        buyerEmail: email,
        audit: conversionAudit
      }
    });
    void sendLifetimeWelcomeEmail(email);

    if (eventName === "order_created" && (amountCents === 14900 || amountCents === 19900)) {
      void nukeUserByEmail({ userEmail: email, scanId: publicScanId ?? null }).catch((e) => {
        console.error("[webhooks/lemon-squeezy] nuke_failed", e);
      });
    }
    if (eventId) {
      void safeDbResult(() => prisma.processedPaddleEvent.create({ data: { eventId } }));
    }
  } catch (e) {
    const code = e instanceof Error ? e.message : "fulfill_failed";
    console.error("[webhooks/lemon-squeezy] fulfill", e);
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
