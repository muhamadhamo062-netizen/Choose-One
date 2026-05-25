import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getObservabilityState, publishObservabilitySignal } from "@/lib/analytics/observability-bus";
import { computeRecoveryDiff } from "@/lib/analytics/recovery-diff-engine";
import { acquireFence, releaseFence } from "@/lib/analytics/global-write-fence";
import { recordStateChange, shouldAllowTransition } from "@/lib/analytics/system-stability-governor";

type RecoverySnapshot = {
  analyticsEventsCount: number;
  materializedGlobal: Record<string, unknown> | null;
  materializedScan: Array<Record<string, unknown>>;
  queueRows: Array<Record<string, unknown>>;
  dlqSummary: { count: number };
};

function controlPlaneStateSnapshot() {
  const emergency = process.env.EMERGENCY_DISABLE_ANALYTICS === "true";
  const mode = emergency
    ? "locked"
    : ((process.env.ANALYTICS_SYSTEM_MODE ?? "normal").toLowerCase() as "normal" | "read_only" | "degraded" | "locked");
  const systemMode = mode === "read_only" || mode === "degraded" || mode === "locked" ? mode : "normal";
  return {
    systemMode,
    analyticsWritesEnabled: systemMode === "normal" || systemMode === "degraded",
    projectionsEnabled: systemMode === "normal" || systemMode === "degraded",
    replayEnabled: systemMode !== "locked",
    healingEnabled: systemMode === "normal"
  };
}

async function buildSnapshot(): Promise<RecoverySnapshot> {
  const [analyticsEventsCount, global, scans, queueRows, dlqCount] = await Promise.all([
    prisma.analyticsEvent.count(),
    prisma.analyticsMaterializedGlobal.findUnique({ where: { id: "global" } }),
    prisma.analyticsMaterializedScan.findMany(),
    prisma.analyticsProjectionQueue.findMany(),
    prisma.analyticsProjectionDeadLetterQueue.count()
  ]);
  return {
    analyticsEventsCount,
    materializedGlobal: global
      ? {
          totalScans: global.totalScans,
          totalSourcesFound: global.totalSourcesFound,
          totalRemovalRequests: global.totalRemovalRequests,
          verifiedRemovals: global.verifiedRemovals,
          rejectedEvents: global.rejectedEvents,
          duplicateEvents: global.duplicateEvents
        }
      : null,
    materializedScan: scans.map((s) => ({
      scanId: s.scanId,
      sourcesFound: s.sourcesFound,
      verificationStatus: s.verificationStatus,
      eventCount: s.eventCount
    })),
    queueRows: queueRows.map((q) => ({
      eventId: q.eventId,
      priority: q.priority,
      status: q.status,
      attempts: q.attempts,
      availableAt: q.availableAt.toISOString(),
      expiresAt: q.expiresAt.toISOString(),
      lastError: q.lastError
    })),
    dlqSummary: { count: dlqCount }
  };
}

export async function captureRecoveryPoint(label: string) {
  const [snapshot, controlState, observabilityState] = await Promise.all([
    buildSnapshot(),
    Promise.resolve(controlPlaneStateSnapshot()),
    Promise.resolve(getObservabilityState())
  ]);
  const row = await prisma.analyticsRecoveryPoint.create({
    data: {
      label,
      snapshot: snapshot as Prisma.InputJsonValue,
      controlPlaneState: controlState as Prisma.InputJsonValue,
      observabilityState: observabilityState as Prisma.InputJsonValue
    }
  });
  publishObservabilitySignal({
    type: "RECOVERY_POINT_CREATED",
    severity: "warn",
    payload: { pointId: row.id, label }
  });
  return row;
}

export async function listRecoveryPoints() {
  const rows = await prisma.analyticsRecoveryPoint.findMany({
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    createdAt: r.createdAt.toISOString()
  }));
}

export async function restoreRecoveryPoint(pointId: string, opts?: { force?: boolean; dryRun?: boolean }) {
  const row = await prisma.analyticsRecoveryPoint.findUnique({ where: { id: pointId } });
  if (!row) {
    return { ok: false as const, error: "recovery_point_not_found" };
  }
  const snapshot = row.snapshot as RecoverySnapshot;
  const diff = await computeRecoveryDiff(snapshot);

  const control = controlPlaneStateSnapshot();
  const activeWorkers = await prisma.analyticsProjectionQueue.count({ where: { status: "processing" } });
  const blocked = control.systemMode !== "locked" || (activeWorkers > 0 && !opts?.force);
  if (blocked) {
    publishObservabilitySignal({
      type: "RECOVERY_BLOCKED",
      severity: "error",
      payload: {
        pointId,
        mode: control.systemMode,
        activeWorkers,
        force: Boolean(opts?.force)
      }
    });
    return {
      ok: false as const,
      error: "rollback_blocked",
      dryRun: true,
      diff
    };
  }

  if (opts?.dryRun) {
    return {
      ok: true as const,
      dryRun: true,
      diff
    };
  }

  // Recovery is emergency-safe and should always pass governor policy.
  void shouldAllowTransition("recovery", "restore_started");
  recordStateChange("recovery", "restore_started");
  const fence = await acquireFence("recovery_restore", 10 * 60_000, { state: "EXCLUSIVE" });
  try {
    await prisma.$transaction(async (tx) => {
    if (snapshot.materializedGlobal) {
      await tx.analyticsMaterializedGlobal.upsert({
        where: { id: "global" },
        create: {
          id: "global",
          totalScans: Number(snapshot.materializedGlobal.totalScans ?? 0),
          totalSourcesFound: Number(snapshot.materializedGlobal.totalSourcesFound ?? 0),
          totalRemovalRequests: Number(snapshot.materializedGlobal.totalRemovalRequests ?? 0),
          verifiedRemovals: Number(snapshot.materializedGlobal.verifiedRemovals ?? 0),
          rejectedEvents: Number(snapshot.materializedGlobal.rejectedEvents ?? 0),
          duplicateEvents: Number(snapshot.materializedGlobal.duplicateEvents ?? 0)
        },
        update: {
          totalScans: Number(snapshot.materializedGlobal.totalScans ?? 0),
          totalSourcesFound: Number(snapshot.materializedGlobal.totalSourcesFound ?? 0),
          totalRemovalRequests: Number(snapshot.materializedGlobal.totalRemovalRequests ?? 0),
          verifiedRemovals: Number(snapshot.materializedGlobal.verifiedRemovals ?? 0),
          rejectedEvents: Number(snapshot.materializedGlobal.rejectedEvents ?? 0),
          duplicateEvents: Number(snapshot.materializedGlobal.duplicateEvents ?? 0)
        }
      });
    }

    await tx.analyticsMaterializedScan.deleteMany();
    if (snapshot.materializedScan.length > 0) {
      await tx.analyticsMaterializedScan.createMany({
        data: snapshot.materializedScan.map((s) => ({
          scanId: String(s.scanId),
          sourcesFound: Number(s.sourcesFound ?? 0),
          verificationStatus: typeof s.verificationStatus === "string" ? s.verificationStatus : null,
          eventCount: Number(s.eventCount ?? 0)
        }))
      });
    }

    await tx.analyticsProjectionQueue.deleteMany();
    if (snapshot.queueRows.length > 0) {
      await tx.analyticsProjectionQueue.createMany({
        data: snapshot.queueRows.map((q) => ({
          eventId: String(q.eventId),
          priority: String(q.priority ?? "LOW"),
          status: String(q.status ?? "pending"),
          attempts: Number(q.attempts ?? 0),
          availableAt: new Date(String(q.availableAt)),
          expiresAt: new Date(String(q.expiresAt)),
          lastError: typeof q.lastError === "string" ? q.lastError : null
        }))
      });
    }
    });

    await prisma.analyticsEvent.create({
      data: {
        eventId: `system_recovery_applied_${pointId}_${Date.now()}`,
        scanId: null,
        userId: null,
        type: "system_recovery_applied",
        metadata: {
          pointId,
          label: row.label,
          appliedAt: new Date().toISOString(),
          diff
        }
      }
    });

    publishObservabilitySignal({
      type: "RECOVERY_POINT_RESTORED",
      severity: "warn",
      payload: { pointId, label: row.label, diff }
    });
    recordStateChange("recovery", "restore_completed");
  } finally {
    await releaseFence(fence.fence.fenceId);
  }

  return {
    ok: true as const,
    dryRun: false,
    diff
  };
}
