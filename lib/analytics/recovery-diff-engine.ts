import { prisma } from "@/lib/prisma";

export type RecoveryDiff = {
  addedEvents: number;
  missingEvents: number;
  driftScore: number;
  unsafeFields: string[];
  summary: {
    currentQueueRows: number;
    recoveryQueueRows: number;
    currentDlqRows: number;
    recoveryDlqRows: number;
  };
};

export async function computeRecoveryDiff(snapshot: {
  analyticsEventsCount: number;
  queueRows: Array<Record<string, unknown>>;
  dlqSummary: { count: number };
}): Promise<RecoveryDiff> {
  const [currentEvents, currentQueue, currentDlq] = await Promise.all([
    prisma.analyticsEvent.count(),
    prisma.analyticsProjectionQueue.count(),
    prisma.analyticsProjectionDeadLetterQueue.count()
  ]);

  const addedEvents = Math.max(0, currentEvents - snapshot.analyticsEventsCount);
  const missingEvents = Math.max(0, snapshot.analyticsEventsCount - currentEvents);
  const queueDelta = Math.abs(currentQueue - snapshot.queueRows.length);
  const dlqDelta = Math.abs(currentDlq - snapshot.dlqSummary.count);
  const driftScore = Math.min(100, addedEvents * 0.03 + missingEvents * 0.03 + queueDelta * 2 + dlqDelta * 4);

  const unsafeFields = [
    "analytics_events (immutable source-of-truth, never restored)",
    "user/subscription/scan business tables"
  ];

  return {
    addedEvents,
    missingEvents,
    driftScore: Math.round(driftScore),
    unsafeFields,
    summary: {
      currentQueueRows: currentQueue,
      recoveryQueueRows: snapshot.queueRows.length,
      currentDlqRows: currentDlq,
      recoveryDlqRows: snapshot.dlqSummary.count
    }
  };
}
