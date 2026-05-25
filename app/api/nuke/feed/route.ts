import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, getUserFromSession } from "@/lib/auth-session";
import { safeDbResult } from "@/lib/safe-db";

export const dynamic = "force-dynamic";

function isPaidSubscription(sub: { plan: string; status: string } | null): boolean {
  return Boolean(sub && sub.plan === "lifetime" && sub.status === "active");
}

function formatFeedLine(e: {
  createdAt: Date;
  properties: unknown;
}): string {
  const p = (e.properties ?? {}) as Record<string, unknown>;
  const broker = typeof p.broker === "string" ? p.broker : "Broker";
  const evidenceId = typeof p.evidenceId === "string" ? p.evidenceId : "EV-????";
  const resendOk = Boolean(p.resendOk);
  const resendId = typeof p.resendId === "string" ? p.resendId : null;
  const err = typeof p.error === "string" ? p.error : null;

  if (resendOk) {
    const rid = resendId ? `#${resendId.slice(0, 6)}` : "#indexed";
    return `[SUCCESS] ${broker}: Removal request ${rid} indexed • Evidence ${evidenceId}`;
  }
  return `[ALERT] ${broker}: Send failed • ${err ?? "unknown_error"} • Evidence ${evidenceId}`;
}

export async function GET() {
  const session = await getSession();
  if (session.kind !== "authed") {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const userRes = await getUserFromSession(session.userId);
  if (!("user" in userRes) || !userRes.user) {
    return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
  }

  const subRes = await safeDbResult(() =>
    prisma.subscription.findFirst({
      where: { userId: userRes.user.id },
      orderBy: { startedAt: "desc" },
      select: { plan: true, status: true }
    })
  );
  const paid = subRes.ok ? isPaidSubscription(subRes.value) : false;
  if (!paid) {
    return NextResponse.json({ ok: false, error: "paid_required" }, { status: 403 });
  }

  const eventsRes = await safeDbResult(() =>
    prisma.event.findMany({
      where: {
        userId: userRes.user.id,
        event: { in: ["nuke_removal_request"] }
      },
      orderBy: { createdAt: "desc" },
      take: 25
    })
  );

  const events = eventsRes.ok ? eventsRes.value : [];
  const lines = events
    .map((e) => ({
      id: e.id,
      createdAt: e.createdAt,
      text: formatFeedLine({ createdAt: e.createdAt, properties: e.properties })
    }))
    .reverse(); // oldest -> newest for scrolling

  return NextResponse.json({ ok: true, lines });
}

