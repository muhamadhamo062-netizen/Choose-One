import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, getUserFromSession } from "@/lib/auth-session";
import { safeDbResult } from "@/lib/safe-db";
import { nukeUserByEmail } from "@/services/remover";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isPaidSubscription(sub: { plan: string; status: string } | null): boolean {
  return Boolean(sub && sub.plan === "lifetime" && sub.status === "active");
}

export async function POST() {
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

  const latestScanRes = await safeDbResult(() =>
    prisma.scan.findFirst({
      where: { userId: userRes.user.id },
      orderBy: { createdAt: "desc" },
      select: { publicScanId: true, state: true }
    })
  );
  const scanId = latestScanRes.ok && latestScanRes.value ? latestScanRes.value.publicScanId : null;
  const stateCode = latestScanRes.ok && latestScanRes.value ? latestScanRes.value.state : null;

  const result = await nukeUserByEmail({
    userEmail: userRes.user.email,
    userFullName: userRes.user.fullName,
    stateCode,
    scanId
  });

  return NextResponse.json({ ok: true, result });
}

