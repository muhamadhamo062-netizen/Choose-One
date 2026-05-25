import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, getUserFromSession } from "@/lib/auth-session";
import { safeDbResult } from "@/lib/safe-db";

export const dynamic = "force-dynamic";

function isPaidSubscription(sub: { plan: string; status: string } | null): boolean {
  return Boolean(sub && sub.plan === "lifetime" && sub.status === "active");
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

  const rep = await safeDbResult(() =>
    prisma.caseReport.findFirst({
      where: { userId: userRes.user.id, status: "ready" },
      orderBy: { createdAt: "desc" },
      select: { publicUrl: true, createdAt: true }
    })
  );
  if (!rep.ok || !rep.value) {
    return NextResponse.json({ ok: true, ready: false });
  }

  return NextResponse.json({ ok: true, ready: true, url: rep.value.publicUrl, createdAt: rep.value.createdAt });
}

