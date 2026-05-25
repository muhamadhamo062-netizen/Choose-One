import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";
import { isLifecycleEvent, validateLifecycleTransition, type AnalyticsLifecycleEvent } from "@/lib/analytics/event-state-machine";

/**
 * Derived projection layer only.
 * Source of truth is `analytics_events`; this module maintains read-optimized aggregates.
 */
const GLOBAL_ID = "global";

export type MaterializedGlobalMetrics = {
  totalScans: number;
  totalSourcesFound: number;
  totalRemovalRequests: number;
  verifiedRemovals: number;
  rejectedEvents: number;
  duplicateEvents: number;
  lastUpdated: string;
};

export type MaterializedScanMetrics = {
  scanId: string;
  sourcesFound: number;
  verificationStatus: string | null;
  eventCount: number;
  lastUpdated: string;
};

type DbClient = PrismaClient | Prisma.TransactionClient;

async function ensureGlobalRow(db: DbClient) {
  return db.analyticsMaterializedGlobal.upsert({
    where: { id: GLOBAL_ID },
    create: { id: GLOBAL_ID },
    update: {}
  });
}

export async function updateMaterializedMetricsForEvent(input: {
  type: string;
  scanId?: string | null;
  metadata?: Record<string, unknown>;
  rejectionReason?: "duplicate_event" | "invalid_sequence";
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const globalInc: {
    totalScans?: number;
    totalSourcesFound?: number;
    totalRemovalRequests?: number;
    verifiedRemovals?: number;
    rejectedEvents?: number;
    duplicateEvents?: number;
  } = {};

  let scanUpsert:
    | {
        scanId: string;
        sourcesFoundInc?: number;
        verificationStatus?: string | null;
      }
    | undefined;

  if (input.type === "scan_created") {
    globalInc.totalScans = 1;
  }
  if (input.type === "discovery_found") {
    const sourcesFound = Number(input.metadata?.sourcesFound ?? 0);
    if (sourcesFound > 0) {
      globalInc.totalSourcesFound = sourcesFound;
      if (input.scanId) {
        scanUpsert = {
          scanId: input.scanId,
          sourcesFoundInc: sourcesFound
        };
      }
    }
  }
  if (input.type === "removal_requested") {
    globalInc.totalRemovalRequests = 1;
  }
  if (input.type === "verified_deleted") {
    globalInc.verifiedRemovals = 1;
    if (input.scanId) {
      scanUpsert = { scanId: input.scanId, verificationStatus: "verified_deleted" };
    }
  }
  if (input.type === "partial_deleted" || input.type === "not_confirmed" || input.type === "verification_started" || input.type === "verification_completed") {
    if (input.scanId) {
      scanUpsert = { scanId: input.scanId, verificationStatus: input.type };
    }
  }
  if (input.type === "event_rejected") {
    globalInc.rejectedEvents = 1;
    if (input.rejectionReason === "duplicate_event") {
      globalInc.duplicateEvents = 1;
    }
  }

  const run = async (tx: Prisma.TransactionClient) => {
    await ensureGlobalRow(tx);
    if (Object.keys(globalInc).length > 0) {
      await tx.analyticsMaterializedGlobal.update({
        where: { id: GLOBAL_ID },
        data: {
          totalScans: { increment: globalInc.totalScans ?? 0 },
          totalSourcesFound: { increment: globalInc.totalSourcesFound ?? 0 },
          totalRemovalRequests: { increment: globalInc.totalRemovalRequests ?? 0 },
          verifiedRemovals: { increment: globalInc.verifiedRemovals ?? 0 },
          rejectedEvents: { increment: globalInc.rejectedEvents ?? 0 },
          duplicateEvents: { increment: globalInc.duplicateEvents ?? 0 }
        }
      });
    }
    if (input.scanId) {
      await tx.analyticsMaterializedScan.upsert({
        where: { scanId: input.scanId },
        create: {
          scanId: input.scanId,
          sourcesFound: scanUpsert?.sourcesFoundInc ?? 0,
          verificationStatus: scanUpsert?.verificationStatus ?? null,
          eventCount: 1
        },
        update: {
          sourcesFound: { increment: scanUpsert?.sourcesFoundInc ?? 0 },
          verificationStatus: scanUpsert?.verificationStatus ?? undefined,
          eventCount: { increment: 1 }
        }
      });
    }
  };

  if (input.tx) {
    await run(input.tx);
    return;
  }
  await prisma.$transaction(run);
}

export async function readMaterializedMetrics(): Promise<{
  global: MaterializedGlobalMetrics;
  scans: MaterializedScanMetrics[];
}> {
  const [g, scans] = await Promise.all([
    ensureGlobalRow(prisma),
    prisma.analyticsMaterializedScan.findMany()
  ]);
  return {
    global: {
      totalScans: g.totalScans,
      totalSourcesFound: g.totalSourcesFound,
      totalRemovalRequests: g.totalRemovalRequests,
      verifiedRemovals: g.verifiedRemovals,
      rejectedEvents: g.rejectedEvents,
      duplicateEvents: g.duplicateEvents,
      lastUpdated: g.lastUpdated.toISOString()
    },
    scans: scans.map((s) => ({
      scanId: s.scanId,
      sourcesFound: s.sourcesFound,
      verificationStatus: s.verificationStatus,
      eventCount: s.eventCount,
      lastUpdated: s.lastUpdated.toISOString()
    }))
  };
}

export async function replaceMaterializedMetrics(input: {
  global: Omit<MaterializedGlobalMetrics, "lastUpdated">;
  scans: Array<Omit<MaterializedScanMetrics, "lastUpdated">>;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.analyticsMaterializedGlobal.upsert({
      where: { id: GLOBAL_ID },
      create: {
        id: GLOBAL_ID,
        totalScans: input.global.totalScans,
        totalSourcesFound: input.global.totalSourcesFound,
        totalRemovalRequests: input.global.totalRemovalRequests,
        verifiedRemovals: input.global.verifiedRemovals,
        rejectedEvents: input.global.rejectedEvents,
        duplicateEvents: input.global.duplicateEvents
      },
      update: {
        totalScans: input.global.totalScans,
        totalSourcesFound: input.global.totalSourcesFound,
        totalRemovalRequests: input.global.totalRemovalRequests,
        verifiedRemovals: input.global.verifiedRemovals,
        rejectedEvents: input.global.rejectedEvents,
        duplicateEvents: input.global.duplicateEvents
      }
    });
    await tx.analyticsMaterializedScan.deleteMany();
    if (input.scans.length > 0) {
      await tx.analyticsMaterializedScan.createMany({
        data: input.scans.map((s) => ({
          scanId: s.scanId,
          sourcesFound: s.sourcesFound,
          verificationStatus: s.verificationStatus,
          eventCount: s.eventCount
        }))
      });
    }
  });
}

export async function computeMaterializedFromRawEvents(): Promise<{
  global: Omit<MaterializedGlobalMetrics, "lastUpdated">;
  scans: Array<Omit<MaterializedScanMetrics, "lastUpdated">>;
}> {
  const allEvents = await prisma.analyticsEvent.findMany({
    where: {
      type: {
        in: [
          "scan_created",
          "scan_completed",
          "discovery_found",
          "removal_requested",
          "verification_started",
          "verification_completed",
          "verified_deleted",
          "partial_deleted",
          "not_confirmed",
          "event_rejected"
        ]
      }
    },
    orderBy: [{ scanId: "asc" }, { createdAt: "asc" }]
  });

  const byScan = new Map<string, { sourcesFound: number; eventCount: number; verificationStatus: string | null }>();
  const lastLifecycle = new Map<string, AnalyticsLifecycleEvent | null>();

  const global = {
    totalScans: 0,
    totalSourcesFound: 0,
    totalRemovalRequests: 0,
    verifiedRemovals: 0,
    rejectedEvents: 0,
    duplicateEvents: 0
  };

  for (const ev of allEvents) {
    if (ev.type === "event_rejected") {
      global.rejectedEvents += 1;
      const reason = (ev.metadata as { reason?: string })?.reason;
      if (reason === "duplicate_event") {
        global.duplicateEvents += 1;
      }
      continue;
    }
    if (!ev.scanId) {
      continue;
    }
    const scan = byScan.get(ev.scanId) ?? { sourcesFound: 0, eventCount: 0, verificationStatus: null };
    scan.eventCount += 1;

    if (isLifecycleEvent(ev.type)) {
      const prev = lastLifecycle.get(ev.scanId) ?? null;
      const check = validateLifecycleTransition(prev, ev.type);
      if (!check.ok) {
        continue;
      }
      lastLifecycle.set(ev.scanId, ev.type);
      if (ev.type === "scan_created") {
        global.totalScans += 1;
      }
      if (ev.type === "verified_deleted") {
        global.verifiedRemovals += 1;
      }
      if (
        ev.type === "verification_started" ||
        ev.type === "verification_completed" ||
        ev.type === "verified_deleted" ||
        ev.type === "partial_deleted" ||
        ev.type === "not_confirmed"
      ) {
        scan.verificationStatus = ev.type;
      }
    }

    if (ev.type === "discovery_found") {
      const sourcesFound = Number((ev.metadata as { sourcesFound?: unknown })?.sourcesFound ?? 0);
      if (sourcesFound > 0) {
        scan.sourcesFound += sourcesFound;
        global.totalSourcesFound += sourcesFound;
      }
    }
    if (ev.type === "removal_requested") {
      global.totalRemovalRequests += 1;
    }
    byScan.set(ev.scanId, scan);
  }

  return {
    global,
    scans: Array.from(byScan.entries()).map(([scanId, row]) => ({
      scanId,
      sourcesFound: row.sourcesFound,
      verificationStatus: row.verificationStatus,
      eventCount: row.eventCount
    }))
  };
}
