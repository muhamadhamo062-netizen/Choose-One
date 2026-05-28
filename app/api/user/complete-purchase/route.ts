import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signSessionToken, SESSION_COOKIE, PENDING_SCAN_COOKIE, sessionCookieOptions } from "@/lib/auth-cookies";
import { fulfillLifetimeEntitlement } from "@/lib/fulfillment/lifetime-entitlement";
import { allowUnverifiedCompletePurchase } from "@/lib/payment-production-guard";

export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  scanId?: string;
};

/**
 * DEV / STAGING ONLY: unverified post-checkout (no billing order id).
 * Production: Lemon Squeezy webhook + POST /api/user/session-from-order.
 */
export async function POST(request: Request) {
  if (!allowUnverifiedCompletePurchase()) {
    return NextResponse.json(
      {
        error: "unverified_checkout_not_allowed",
        state: "USE_WEBHOOK_AND_SESSION_FROM_ORDER",
        detail: "Use Lemon Squeezy webhooks and POST /api/user/session-from-order in production"
      },
      { status: 200 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const scanIdFromBody = typeof body.scanId === "string" ? body.scanId.trim() : "";
  const scanIdFromCookie = cookies().get(PENDING_SCAN_COOKIE)?.value?.trim() ?? "";
  const linkScanId = scanIdFromBody || scanIdFromCookie || null;

  try {
    const userRow = await fulfillLifetimeEntitlement({
      email,
      linkPublicScanId: linkScanId,
      billingOrderId: null
    });

    const token = await signSessionToken(userRow.userId);
    const res = NextResponse.json({
      ok: true,
      user: { id: userRow.userId, email: userRow.email, fullName: userRow.fullName }
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    res.cookies.set(PENDING_SCAN_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "scan_attached_to_other_user") {
      return NextResponse.json({ error: "scan_attached_to_other_user" }, { status: 409 });
    }
    if (msg === "email_mismatch_with_scan") {
      return NextResponse.json({ error: "email_mismatch_with_scan" }, { status: 400 });
    }
    if (msg === "invalid_email") {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }
    if (msg === "database_unavailable") {
      return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 200 });
    }
    console.error("[user/complete-purchase]", e);
    return NextResponse.json({ error: "complete_failed" }, { status: 200 });
  }
}
