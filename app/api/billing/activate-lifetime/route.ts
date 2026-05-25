import { NextResponse } from "next/server";
import { getSessionUserIdFromCookies } from "@/lib/auth-cookies";
import { emitServerEvent } from "@/lib/events/event-emitter";
import { prisma } from "@/lib/prisma";
import { allowUnverifiedActivateLifetime } from "@/lib/payment-production-guard";
import { jsonUnauthorized } from "@/lib/api-response";
import { safeDbResult } from "@/lib/safe-db";
import { enqueueRemovalJobsForUser, executePendingRemovalJobs } from "@/lib/removal-engine";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!allowUnverifiedActivateLifetime()) {
    return NextResponse.json({ error: "activate_lifetime_unverified_not_allowed" }, { status: 403 });
  }
  const userId = await getSessionUserIdFromCookies();
  if (!userId) {
    return jsonUnauthorized();
  }

  void emitServerEvent({
    event: "payment_started",
    userId,
    payload: { flow: "activate_lifetime" }
  });

  const subRes = await safeDbResult(() =>
    prisma.subscription.findFirst({
      where: { userId },
      orderBy: { startedAt: "desc" }
    })
  );
  if (!subRes.ok) {
    return NextResponse.json(
      { ok: false, error: "billing_unavailable", message: "Could not update plan. Please try again." },
      { status: 200 }
    );
  }
  const existing = subRes.value;

  const writeRes = await safeDbResult(async () => {
    if (existing) {
      return prisma.subscription.update({
        where: { id: existing.id },
        data: { plan: "lifetime", status: "active" }
      });
    }
    return prisma.subscription.create({
      data: { userId, plan: "lifetime", status: "active" }
    });
  });
  if (!writeRes.ok) {
    return NextResponse.json(
      { ok: false, error: "billing_unavailable", message: "Could not update plan. Please try again." },
      { status: 200 }
    );
  }

  void emitServerEvent({
    event: "payment_completed",
    userId,
    payload: { plan: "lifetime", flow: "activate_lifetime" }
  });
  void enqueueRemovalJobsForUser({ userId }).then(() => executePendingRemovalJobs(25));
  return NextResponse.json({ ok: true, plan: "lifetime" });
}
