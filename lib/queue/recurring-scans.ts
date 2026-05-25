import { prisma } from "@/lib/prisma";
import { enqueueScan, hasUserPendingRecurringJob } from "@/lib/queue/scan-queue";
import { safeDbResult } from "@/lib/safe-db";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Enqueues recurring discovery jobs for non-free active subscribers when the last
 * successful scan (Scan row) is older than 7 days. Skips if a recurring job
 * is already pending or in progress for that user.
 */
export async function enqueueDueRecurringScansForActiveSubscribers(): Promise<{
  enqueued: number;
}> {
  const paidRes = await safeDbResult(() =>
    prisma.subscription.findMany({
      where: { status: "active", plan: { not: "free" } },
      select: { userId: true }
    })
  );
  if (!paidRes.ok) {
    return { enqueued: 0 };
  }
  const userIds = [...new Set(paidRes.value.map((s) => s.userId))];
  let enqueued = 0;

  for (const userId of userIds) {
    const userRes = await safeDbResult(() => prisma.user.findUnique({ where: { id: userId } }));
    if (!userRes.ok || !userRes.value) {
      continue;
    }
    const user = userRes.value;
    const lastRes = await safeDbResult(() =>
      prisma.scan.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" }
      })
    );
    if (!lastRes.ok || !lastRes.value) {
      continue;
    }
    const lastScan = lastRes.value;
    if (Date.now() - lastScan.createdAt.getTime() < SEVEN_DAYS_MS) {
      continue;
    }
    if (await hasUserPendingRecurringJob(userId)) {
      continue;
    }
    const fullName = user.fullName?.trim() || user.email.split("@")[0] || "Member";
    await enqueueScan({
      userId,
      fullName,
      email: user.email,
      stateCode: lastScan.state,
      kind: "recurring"
    });
    enqueued += 1;
  }

  return { enqueued };
}
