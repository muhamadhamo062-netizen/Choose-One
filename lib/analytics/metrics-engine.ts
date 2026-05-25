import { prisma } from "@/lib/prisma";
import { isLifecycleEvent, validateLifecycleTransition, type AnalyticsLifecycleEvent } from "@/lib/analytics/event-state-machine";
import { readMaterializedMetrics } from "@/lib/analytics/materialized-metrics";
import { runConsistencyCheck } from "@/lib/analytics/consistency-checker";
import { getActiveRegion, getRegionSchemaVersion } from "@/lib/analytics/region/region-context";
import { getRegionHealth } from "@/lib/analytics/region/region-health-monitor";
import { upcastEvent } from "@/lib/analytics/schema/event-upcaster";

export type DashboardMetrics = {
  scans: number;
  sourcesFound: number;
  removalsRequested: number;
  verifiedRemovals: number;
  pending: number;
  successRate: number;
  failureRate: number;
  lastUpdated: string;
};

export type DashboardMetricsDebug = {
  eventCounts: Record<string, number>;
  validEventCounts: Record<string, number>;
  formulas: Record<string, string>;
  validEventsCount: number;
  rejectedEventsCount: number;
  sequenceViolations: number;
  duplicateEventsDetected: number;
  consistency: {
    scansTableCount: number;
    scanCreatedEvents: number;
    delta: number;
  };
  consistencyChecks?: {
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
  replayDerived?: {
    scans: number;
    sourcesFound: number;
    removalsRequested: number;
    verifiedRemovals: number;
    pending: number;
    successRate: number;
    failureRate: number;
  };
};

function pct(num: number, den: number): number {
  if (den <= 0) {
    return 0;
  }
  return Number(((num / den) * 100).toFixed(2));
}

function toCountMap(rows: Array<{ type: string; _count: { _all: number } }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[r.type] = r._count._all;
  }
  return out;
}

async function computeReplayDebug(): Promise<DashboardMetricsDebug> {
  const [grouped, allEvents] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["type"],
      _count: { _all: true }
    }),
    prisma.analyticsEvent.findMany({
      where: {
        OR: [
          { type: { in: ["scan_created", "scan_completed", "discovery_found", "verification_started", "verification_completed", "verified_deleted", "partial_deleted", "not_confirmed", "removal_requested", "event_rejected"] } }
        ]
      },
      orderBy: [{ scanId: "asc" }, { createdAt: "asc" }]
    })
  ]);

  const counts = toCountMap(grouped);

  const validCounts: Record<string, number> = {};
  const validScanIds = new Set<string>();
  const lastLifecycleByScan = new Map<string, AnalyticsLifecycleEvent | null>();
  let validEventsCount = 0;
  let sequenceViolations = 0;
  let duplicateEventsDetected = 0;
  const targetVersion = getRegionSchemaVersion(getActiveRegion());

  for (const ev of allEvents) {
    const normalized = upcastEvent(
      {
        type: ev.type,
        metadata: (ev.metadata as Record<string, unknown>) ?? {}
      },
      targetVersion
    );
    const normalizedType = normalized.type;
    const meta = normalized.metadata as { reason?: string };
    if (normalizedType === "event_rejected") {
      if (meta?.reason === "duplicate_event") {
        duplicateEventsDetected += 1;
      }
      if (meta?.reason === "invalid_sequence") {
        sequenceViolations += 1;
      }
      continue;
    }
    if (!ev.scanId) {
      continue;
    }
    if (isLifecycleEvent(normalizedType)) {
      const prev = lastLifecycleByScan.get(ev.scanId) ?? null;
      const check = validateLifecycleTransition(prev, normalizedType as AnalyticsLifecycleEvent);
      if (!check.ok) {
        sequenceViolations += 1;
        continue;
      }
      lastLifecycleByScan.set(ev.scanId, normalizedType as AnalyticsLifecycleEvent);
      validScanIds.add(ev.scanId);
      validCounts[normalizedType] = (validCounts[normalizedType] ?? 0) + 1;
      validEventsCount += 1;
      continue;
    }
    if (normalizedType === "removal_requested" && validScanIds.has(ev.scanId)) {
      validCounts[normalizedType] = (validCounts[normalizedType] ?? 0) + 1;
      validEventsCount += 1;
    }
  }

  const verifiedScanIds = Array.from(validScanIds);
  const scanRows =
    verifiedScanIds.length > 0
      ? await prisma.scan.findMany({
          where: { publicScanId: { in: verifiedScanIds } },
          select: { brokersFound: true }
        })
      : [];
  const scanCount = scanRows.length;
  const sourcesFound = scanRows.reduce((sum, row) => sum + row.brokersFound, 0);

  const removalsRequested = validCounts.removal_requested ?? 0;
  const verifiedRemovals = validCounts.verified_deleted ?? 0;
  const verificationCompleted = validCounts.verification_completed ?? 0;
  const notConfirmed = validCounts.not_confirmed ?? 0;
  const verificationStarted = validCounts.verification_started ?? 0;
  const pending = Math.max(0, verificationStarted - verificationCompleted);

  const consistencyChecks = await runConsistencyCheck();
  const replayDerived = {
    scans: validCounts.scan_created ?? 0,
    sourcesFound,
    removalsRequested,
    verifiedRemovals,
    pending,
    successRate: pct(verifiedRemovals, verificationCompleted),
    failureRate: pct(notConfirmed, verificationCompleted)
  };
  return {
    eventCounts: counts,
    validEventCounts: validCounts,
    formulas: {
      scans: "count(scan where publicScanId in valid state-machine chains)",
      sourcesFound: "sum(scan.brokersFound for valid chain scanIds)",
      removalsRequested: "count(valid removal_requested with scanId in valid chains)",
      verifiedRemovals: "count(valid verified_deleted transitions)",
      pending: "max(0, valid verification_started - valid verification_completed)",
      successRate: "valid verified_deleted / valid verification_completed * 100",
      failureRate: "valid not_confirmed / valid verification_completed * 100"
    },
    validEventsCount,
    rejectedEventsCount: counts.event_rejected ?? 0,
    sequenceViolations,
    duplicateEventsDetected,
    consistency: {
      scansTableCount: scanCount,
      scanCreatedEvents: validCounts.scan_created ?? 0,
      delta: scanCount - (validCounts.scan_created ?? 0)
    },
    consistencyChecks,
    replayDerived
  };
}

export async function computeDashboardMetrics(input?: {
  debug?: boolean;
  debugReplay?: boolean;
  globalAggregation?: boolean;
}): Promise<{ metrics: DashboardMetrics; debug?: DashboardMetricsDebug }> {
  if (input?.debugReplay) {
    const debug = await computeReplayDebug();
    const verificationCompleted = (debug.validEventCounts.verification_completed ?? 0);
    const verifiedRemovals = debug.validEventCounts.verified_deleted ?? 0;
    const notConfirmed = debug.validEventCounts.not_confirmed ?? 0;
    const pending = Math.max(
      0,
      (debug.validEventCounts.verification_started ?? 0) - verificationCompleted
    );
    const metrics: DashboardMetrics = {
      scans: debug.replayDerived?.scans ?? debug.consistency.scanCreatedEvents,
      sourcesFound: debug.replayDerived?.sourcesFound ?? 0,
      removalsRequested: debug.replayDerived?.removalsRequested ?? (debug.validEventCounts.removal_requested ?? 0),
      verifiedRemovals,
      pending,
      successRate: debug.replayDerived?.successRate ?? pct(verifiedRemovals, verificationCompleted),
      failureRate: debug.replayDerived?.failureRate ?? pct(notConfirmed, verificationCompleted),
      lastUpdated: new Date().toISOString()
    };
    if (input?.debug) {
      return { metrics, debug };
    }
    return { metrics };
  }

  const localRegion = getActiveRegion();
  const materialized = await readMaterializedMetrics();
  // Region-aware read strategy: local first, fallback to replicated view path (same DB mirror in this layer).
  const regionHealth = getRegionHealth();
  const localHealthy = regionHealth[localRegion]?.healthy ?? true;
  const effectiveMaterialized = localHealthy ? materialized : await readMaterializedMetrics();
  const base = input?.globalAggregation ? await readMaterializedMetrics() : effectiveMaterialized;
  const verificationCompleted = base.scans.filter(
    (s) =>
      s.verificationStatus === "verification_completed" ||
      s.verificationStatus === "verified_deleted" ||
      s.verificationStatus === "partial_deleted" ||
      s.verificationStatus === "not_confirmed"
  ).length;
  const pending = base.scans.filter(
    (s) => s.verificationStatus === "verification_started"
  ).length;
  const notConfirmed = base.scans.filter((s) => s.verificationStatus === "not_confirmed").length;
  const metrics: DashboardMetrics = {
    scans: base.global.totalScans,
    sourcesFound: base.global.totalSourcesFound,
    removalsRequested: base.global.totalRemovalRequests,
    verifiedRemovals: base.global.verifiedRemovals,
    pending,
    successRate: pct(base.global.verifiedRemovals, verificationCompleted),
    failureRate: pct(notConfirmed, verificationCompleted),
    lastUpdated: base.global.lastUpdated
  };
  if (!input?.debug) {
    return { metrics };
  }
  const debug = await computeReplayDebug();
  return { metrics, debug };
}
