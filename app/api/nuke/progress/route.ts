import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, getUserFromSession } from "@/lib/auth-session";
import { safeDbResult } from "@/lib/safe-db";

export const dynamic = "force-dynamic";

const BROKERS = ["Whitepages", "Spokeo", "MyLife", "Radaris", "Intelius"] as const;

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

  const jobsRes = await safeDbResult(() =>
    prisma.removalJob.findMany({
      where: {
        userId: userRes.user.id,
        brokerName: { in: [...BROKERS] }
      },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        brokerName: true,
        status: true,
        requestedAt: true,
        lastError: true
      }
    })
  );

  const jobs = jobsRes.ok ? jobsRes.value : [];
  const byBroker = new Map<string, (typeof jobs)[number]>();
  for (const j of jobs) {
    if (!byBroker.has(j.brokerName)) {
      byBroker.set(j.brokerName, j); // keep most recent
    }
  }

  const now = Date.now();
  const rows = BROKERS.map((name) => {
    const j = byBroker.get(name);
    if (!j) {
      return { broker: name, status: "Targeting..." as const, detail: null as string | null };
    }
    if (j.status === "pending") {
      return { broker: name, status: "Targeting..." as const, detail: null as string | null };
    }
    if (j.status === "sent") {
      const ageMs = j.requestedAt ? now - new Date(j.requestedAt).getTime() : 0;
      const label = ageMs < 1000 * 60 * 10 ? "Legal Notice Sent" : "Pending Deletion";
      return { broker: name, status: label as "Legal Notice Sent" | "Pending Deletion", detail: null as string | null };
    }
    if (j.status === "verified") {
      return { broker: name, status: "Pending Deletion" as const, detail: "Verified deletion (internal)" };
    }
    if (j.status === "failed") {
      return { broker: name, status: "Targeting..." as const, detail: j.lastError ?? "failed" };
    }
    return { broker: name, status: "Targeting..." as const, detail: null as string | null };
  });

  return NextResponse.json({ ok: true, paid: true, rows });
}

