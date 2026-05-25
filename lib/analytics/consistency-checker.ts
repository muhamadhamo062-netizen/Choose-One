import { prisma } from "@/lib/prisma";
import { readMaterializedMetrics } from "@/lib/analytics/materialized-metrics";
import { getProjectionQueueDepths } from "@/lib/analytics/event-queue";

export type ConsistencyReport = {
  missingEvents: number;
  duplicateSpikes: number;
  counterMismatches: Array<{ metric: string; materialized: number; raw: number }>;
  queueDepths: {
    queue_depth_high: number;
    queue_depth_normal: number;
    queue_depth_low: number;
    dlq_count: number;
    expired_events_count: number;
  };
};

export async function runConsistencyCheck(): Promise<ConsistencyReport> {
  const [materialized, grouped, duplicateRecent, queueDepths] = await Promise.all([
    readMaterializedMetrics(),
    prisma.analyticsEvent.groupBy({
      by: ["type"],
      _count: { _all: true }
    }),
    prisma.analyticsEvent.count({
      where: {
        type: "event_rejected",
        metadata: { path: ["reason"], equals: "duplicate_event" },
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }
      }
    }),
    getProjectionQueueDepths()
  ]);
  const counts: Record<string, number> = {};
  for (const g of grouped) {
    counts[g.type] = g._count._all;
  }

  const rawScans = counts.scan_created ?? 0;
  const rawRemovals = counts.removal_requested ?? 0;
  const rawVerified = counts.verified_deleted ?? 0;
  const rawRejected = counts.event_rejected ?? 0;

  const counterMismatches: Array<{ metric: string; materialized: number; raw: number }> = [];
  if (materialized.global.totalScans !== rawScans) {
    counterMismatches.push({ metric: "totalScans", materialized: materialized.global.totalScans, raw: rawScans });
  }
  if (materialized.global.totalRemovalRequests !== rawRemovals) {
    counterMismatches.push({
      metric: "totalRemovalRequests",
      materialized: materialized.global.totalRemovalRequests,
      raw: rawRemovals
    });
  }
  if (materialized.global.verifiedRemovals !== rawVerified) {
    counterMismatches.push({
      metric: "verifiedRemovals",
      materialized: materialized.global.verifiedRemovals,
      raw: rawVerified
    });
  }
  if (materialized.global.rejectedEvents !== rawRejected) {
    counterMismatches.push({
      metric: "rejectedEvents",
      materialized: materialized.global.rejectedEvents,
      raw: rawRejected
    });
  }

  return {
    missingEvents: Math.max(0, rawScans - materialized.scans.length),
    duplicateSpikes: duplicateRecent,
    counterMismatches,
    queueDepths
  };
}
