import { prisma } from "@/lib/prisma";

export const MANUAL_DEEP_SCAN_MONTHLY_LIMIT = 5;
export const AUTOMATED_AUDIT_MONTHLY_LIMIT = 2;

export type ScanQuotaSnapshot = {
  used: number;
  limit: number;
  remaining: number;
  cycleStart: string;
};

export type LifetimeSubscriptionRow = {
  plan: string;
  status: string;
  startedAt: Date;
};

export function isActiveLifetimeSubscription(sub: LifetimeSubscriptionRow | null | undefined): boolean {
  return Boolean(sub && sub.plan === "lifetime" && sub.status === "active");
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Monthly billing window anchored to subscription `startedAt` (UTC). */
export function getBillingCycleStart(subscriptionStartedAt: Date, now: Date = new Date()): Date {
  const anchorDay = subscriptionStartedAt.getUTCDate();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  let day = Math.min(anchorDay, daysInUtcMonth(year, month));
  let cycleStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

  if (now < cycleStart) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    day = Math.min(anchorDay, daysInUtcMonth(year, month));
    cycleStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }

  return cycleStart;
}

export function buildQuotaSnapshot(used: number, limit: number, cycleStart: Date): ScanQuotaSnapshot {
  const remaining = Math.max(0, limit - used);
  return {
    used,
    limit,
    remaining,
    cycleStart: cycleStart.toISOString()
  };
}

export async function countDeepScanUsage(
  userId: string,
  kind: "manual" | "automated_audit",
  cycleStart: Date
): Promise<number> {
  return prisma.deepScanUsage.count({
    where: {
      userId,
      kind,
      cycleStart
    }
  });
}

export async function getManualDeepScanQuota(
  userId: string,
  subscriptionStartedAt: Date
): Promise<ScanQuotaSnapshot> {
  const cycleStart = getBillingCycleStart(subscriptionStartedAt);
  const used = await countDeepScanUsage(userId, "manual", cycleStart);
  return buildQuotaSnapshot(used, MANUAL_DEEP_SCAN_MONTHLY_LIMIT, cycleStart);
}

export async function getAutomatedAuditQuota(
  userId: string,
  subscriptionStartedAt: Date
): Promise<ScanQuotaSnapshot> {
  const cycleStart = getBillingCycleStart(subscriptionStartedAt);
  const used = await countDeepScanUsage(userId, "automated_audit", cycleStart);
  return buildQuotaSnapshot(used, AUTOMATED_AUDIT_MONTHLY_LIMIT, cycleStart);
}

export async function recordDeepScanUsage(input: {
  userId: string;
  kind: "manual" | "automated_audit";
  subscriptionStartedAt: Date;
  publicScanId?: string;
}): Promise<void> {
  const cycleStart = getBillingCycleStart(input.subscriptionStartedAt);
  await prisma.deepScanUsage.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      cycleStart,
      publicScanId: input.publicScanId ?? null
    }
  });
}

export async function resolveDashboardScansRemaining(userId: string): Promise<ScanQuotaSnapshot | null> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, plan: "lifetime", status: "active" },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true, plan: true, status: true }
  });
  if (!isActiveLifetimeSubscription(sub)) {
    return null;
  }
  return getManualDeepScanQuota(userId, sub.startedAt);
}
