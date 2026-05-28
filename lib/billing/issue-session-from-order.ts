import { NextResponse } from "next/server";
import { signSessionToken, SESSION_COOKIE, PENDING_SCAN_COOKIE, sessionCookieOptions } from "@/lib/auth-cookies";
import { prisma } from "@/lib/prisma";
import { safeDbResult } from "@/lib/safe-db";
import { jsonServiceDegraded } from "@/lib/api-response";

export async function issueSessionFromBillingOrder(orderId: string): Promise<NextResponse> {
  if (!process.env.LEMON_SQUEEZY_WEBHOOK_SECRET?.trim()) {
    return jsonServiceDegraded("webhook_secret_required");
  }

  const id = orderId.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "order_id_required" }, { status: 400 });
  }

  const subRes = await safeDbResult(() =>
    prisma.subscription.findFirst({
      where: { paddleTransactionId: id, plan: "lifetime", status: "active" },
      include: { user: true }
    })
  );
  if (!subRes.ok) {
    return NextResponse.json(
      { ok: false, state: "SERVICE_DEGRADED", code: "database_unavailable", message: "Please try again shortly." },
      { status: 200 }
    );
  }
  const sub = subRes.value;

  if (!sub?.user) {
    return NextResponse.json({ ok: false, state: "NOT_READY", code: "order_not_confirmed" }, { status: 404 });
  }

  const token = await signSessionToken(sub.user.id);
  const res = NextResponse.json({
    ok: true,
    user: { id: sub.user.id, email: sub.user.email, fullName: sub.user.fullName }
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  res.cookies.set(PENDING_SCAN_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
