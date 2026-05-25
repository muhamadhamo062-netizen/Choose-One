import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSession, getUserFromSession } from "@/lib/auth-session";
import { safeDbResult } from "@/lib/safe-db";
import { NukeDashboardClient } from "@/components/dashboard/NukeDashboardClient";

const BROKERS = ["Whitepages", "Spokeo", "MyLife", "Radaris", "Intelius"] as const;

function isPaidSubscription(sub: { plan: string; status: string } | null): boolean {
  return Boolean(sub && sub.plan === "lifetime" && sub.status === "active");
}

export const metadata: Metadata = {
  title: "Auto-Remover (Nuke) Progress | PrivacyEraser.ai",
  description: "Track real-time broker takedown progress for your paid protection."
};

export default async function NukePage() {
  // SSR preload so the dashboard header/status isn't slow or missing on refresh.
  let initialRows: Array<{ broker: string; status: string; detail: string | null }> | null = null;
  let initialError: string | null = null;

  const session = await getSession();
  if (session.kind !== "authed") {
    initialError = "unauthorized";
  } else {
    const userRes = await getUserFromSession(session.userId);
    if (!("user" in userRes) || !userRes.user) {
      initialError = "user_not_found";
    } else {
      const subRes = await safeDbResult(() =>
        prisma.subscription.findFirst({
          where: { userId: userRes.user.id },
          orderBy: { startedAt: "desc" },
          select: { plan: true, status: true }
        })
      );
      const paid = subRes.ok ? isPaidSubscription(subRes.value) : false;
      if (!paid) {
        initialError = "paid_required";
      } else {
        const jobsRes = await safeDbResult(() =>
          prisma.removalJob.findMany({
            where: { userId: userRes.user.id, brokerName: { in: [...BROKERS] } },
            orderBy: { createdAt: "desc" },
            select: { brokerName: true, status: true, requestedAt: true, lastError: true, createdAt: true }
          })
        );
        const jobs = jobsRes.ok ? jobsRes.value : [];
        const byBroker = new Map<string, (typeof jobs)[number]>();
        for (const j of jobs) {
          if (!byBroker.has(j.brokerName)) byBroker.set(j.brokerName, j);
        }
        const now = Date.now();
        initialRows = BROKERS.map((name) => {
          const j = byBroker.get(name);
          if (!j) return { broker: name, status: "Targeting...", detail: null };
          if (j.status === "pending") return { broker: name, status: "Targeting...", detail: null };
          if (j.status === "sent") {
            const ageMs = j.requestedAt ? now - new Date(j.requestedAt).getTime() : 0;
            const label = ageMs < 1000 * 60 * 10 ? "Legal Notice Sent" : "Pending Deletion";
            return { broker: name, status: label, detail: null };
          }
          if (j.status === "verified") return { broker: name, status: "Pending Deletion", detail: "Verified deletion (internal)" };
          if (j.status === "failed") return { broker: name, status: "Targeting...", detail: j.lastError ?? "failed" };
          return { broker: name, status: "Targeting...", detail: null };
        });
      }
    }
  }

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col bg-slate-950/40">
      <div className="section-container py-8">
        <NukeDashboardClient initialRows={initialRows} initialError={initialError} />
      </div>
    </main>
  );
}

