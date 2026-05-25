import { prisma } from "@/lib/prisma";
import { safeDbResult } from "@/lib/safe-db";
import { updateMaterializedMetricsForEvent } from "@/lib/analytics/materialized-metrics";
import { publishEvent } from "@/lib/analytics/event-stream";
import { emitServerEvent } from "@/lib/events/event-emitter";
import { advanceReplayCursorIfValid, writeTimeTravelSnapshot } from "@/lib/analytics/time-travel-snapshots";
import { validateSnapshotAgainstReplay } from "@/lib/analytics/snapshot-consistency-validator";
import { withCircuitBreaker } from "@/lib/analytics/circuit-breaker";
import { injectFailure } from "@/lib/analytics/failure-injection";
import { assertSystemAllowed } from "@/lib/analytics/system-control-plane";
import { publishObservabilitySignal } from "@/lib/analytics/observability-bus";
import { captureRecoveryPoint } from "@/lib/analytics/recovery-points";
import { isWriteAllowed } from "@/lib/analytics/global-write-fence";
import { getActiveRegion, getRegionSchemaVersion } from "@/lib/analytics/region/region-context";
import { getQueueNamespace } from "@/lib/analytics/event-queue";
import { upcastEvent } from "@/lib/analytics/schema/event-upcaster";
import { isCompatible } from "@/lib/analytics/schema/event-schema-registry";
import { recordSchemaDrift } from "@/lib/analytics/schema/schema-drift-detector";
import { canExecute } from "@/lib/analytics/cost/cost-governor";
import { getCurrentCostPressure, trackCost } from "@/lib/analytics/cost/cost-meter";

const MAX_RETRIES = 3;
const DEFAULT_MAX_CONCURRENCY = 3;
const RETRY_SCHEDULE_MS = [1000, 5000, 15000] as const;

function maxConcurrency(): number {
  const raw = Number(process.env.ANALYTICS_QUEUE_MAX_CONCURRENCY ?? "");
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_MAX_CONCURRENCY;
  }
  return Math.max(1, Math.floor(raw));
}

function backoffMs(attempt: number): number {
  const idx = Math.max(0, Math.min(RETRY_SCHEDULE_MS.length - 1, attempt - 1));
  return RETRY_SCHEDULE_MS[idx] ?? RETRY_SCHEDULE_MS[RETRY_SCHEDULE_MS.length - 1];
}

function isTransientProjectionError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("connection") ||
    msg.includes("econnrefused") ||
    msg.includes("temporar") ||
    msg.includes("prisma")
  );
}

async function markExpired(queueId: string, eventId: string, status: "expired" | "skipped_expired"): Promise<void> {
  await safeDbResult(() =>
    prisma.analyticsProjectionQueue.update({
      where: { id: queueId },
      data: { status, lastError: "queue_item_expired", processedAt: new Date() }
    })
  );
  void emitServerEvent({
    event: "analytics_projection_expired",
    payload: {
      eventId,
      status,
      at: new Date().toISOString()
    }
  });
}

export async function projectAnalyticsEvent(eventId: string): Promise<void> {
  try {
  await prisma.$transaction(async (tx) => {
    const done = await tx.analyticsProjectionProcessed.findUnique({ where: { eventId } });
    if (done) {
      return;
    }
    const ev = await tx.analyticsEvent.findUnique({ where: { eventId } });
    if (!ev) {
      throw new Error(`analytics_event_not_found:${eventId}`);
    }
    const localSchemaVersion = getRegionSchemaVersion(getActiveRegion());
    const upcasted = upcastEvent(
      {
        type: ev.type,
        metadata: (ev.metadata as Record<string, unknown>) ?? {}
      },
      localSchemaVersion
    );
    const metadata = upcasted.metadata;
    const fromVersion = Number((ev.metadata as Record<string, unknown> | null)?.eventVersion ?? 1);
    if (!isCompatible(fromVersion, localSchemaVersion)) {
      recordSchemaDrift({
        region: getActiveRegion(),
        expected: localSchemaVersion,
        actual: fromVersion,
        type: ev.type
      });
    }
    const reason = metadata?.reason;
    await updateMaterializedMetricsForEvent({
      type: ev.type,
      scanId: ev.scanId ?? null,
      metadata,
      rejectionReason: reason === "duplicate_event" || reason === "invalid_sequence" ? reason : undefined,
      tx
    });
    await tx.analyticsProjectionProcessed.create({
      data: { eventId }
    });
  });

  const ev = await prisma.analyticsEvent.findUnique({ where: { eventId } });
  if (!ev) {
    return;
  }
  if (ev.scanId && (ev.type === "scan_completed" || ev.type === "verification_completed")) {
    const [scanMetrics, cursor] = await Promise.all([
      prisma.analyticsMaterializedScan.findUnique({ where: { scanId: ev.scanId } }),
      prisma.analyticsEvent.count({
        where: { scanId: ev.scanId, createdAt: { lte: ev.createdAt } }
      })
    ]);
    if (scanMetrics) {
      await writeTimeTravelSnapshot({
        scanId: ev.scanId,
        eventId: ev.eventId,
        eventType: ev.type,
        eventCursor: cursor,
        materializedState: {
          sourcesFound: scanMetrics.sourcesFound,
          verificationStatus: scanMetrics.verificationStatus,
          eventCount: scanMetrics.eventCount
        }
      });
      void (async () => {
        try {
          const check = await validateSnapshotAgainstReplay(ev.scanId!);
          const driftThreshold = Number(process.env.REPLAY_DRIFT_ALERT_THRESHOLD ?? "10");
          await advanceReplayCursorIfValid({
            scanId: ev.scanId!,
            eventCursor: cursor,
            eventId: ev.eventId,
            state: ev.type,
            derivedStateHash: check.replay.finalState.replayHash,
            isConsistent: check.isConsistent
          });
          if (check.driftScore > driftThreshold) {
            publishObservabilitySignal({
              type: "replay_drift_detected",
              severity: "error",
              payload: { scanId: ev.scanId, driftScore: check.driftScore }
            });
            await emitServerEvent({
              event: "REPLAY_DRIFT_DETECTED",
              payload: {
                scanId: ev.scanId,
                eventId: ev.eventId,
                driftScore: check.driftScore,
                mismatches: check.mismatches
              }
            });
            await prisma.analyticsEvent.create({
              data: {
                eventId: `replay_drift_${ev.eventId}_${Date.now()}`,
                scanId: ev.scanId,
                userId: ev.userId ?? null,
                type: "replay_drift_detected",
                metadata: {
                  driftScore: check.driftScore,
                  mismatches: check.mismatches,
                  at: new Date().toISOString()
                }
              }
            });
          }
        } catch {
          // non-blocking diagnostic hook
        }
      })();

      void (async () => {
        try {
          if (ev.type === "verification_completed") {
            await captureRecoveryPoint("auto_verification_completed");
            return;
          }
          const n = Number(process.env.ANALYTICS_RECOVERY_POINT_EVERY_N_SCANS ?? "25");
          const every = Number.isFinite(n) && n > 0 ? Math.floor(n) : 25;
          const completedScans = await prisma.analyticsEvent.count({
            where: { type: "scan_completed" }
          });
          if (completedScans % every === 0) {
            await captureRecoveryPoint(`auto_scan_completed_batch_${completedScans}`);
          }
        } catch {
          // non-blocking diagnostic hook
        }
      })();
    }
  }
  publishEvent({
    eventId: ev.eventId,
    scanId: ev.scanId ?? null,
    type: ev.type,
    createdAt: ev.createdAt.toISOString()
  });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("DB ERROR:", e);
  }
}

export async function processProjectionQueueItem(queueId: string): Promise<void> {
  const rowRes = await safeDbResult(() => prisma.analyticsProjectionQueue.findUnique({ where: { id: queueId } }));
  if (!rowRes.ok) {
    return;
  }
  const row = rowRes.value;
  if (!row || row.status === "processed") {
    return;
  }
  if (new Date() > row.expiresAt) {
    await markExpired(queueId, row.eventId, "skipped_expired");
    return;
  }
  try {
    await projectAnalyticsEvent(row.eventId);
    await safeDbResult(() =>
      prisma.analyticsProjectionQueue.update({
        where: { id: queueId },
        data: {
          status: "processed",
          processedAt: new Date(),
          lastError: null
        }
      })
    );
  } catch (error) {
    const nextAttempts = row.attempts + 1;
    const transient = isTransientProjectionError(error);
    if (!transient) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack ?? "" : "";
      await safeDbResult(() =>
        prisma.$transaction(async (tx) => {
          await tx.analyticsProjectionDeadLetterQueue.upsert({
            where: { eventId: row.eventId },
            create: {
              eventId: row.eventId,
              error: msg.slice(0, 4000),
              stackTrace: stack.slice(0, 4000),
              retryCount: row.attempts,
              lastKnownState: row.status
            },
            update: {
              error: msg.slice(0, 4000),
              stackTrace: stack.slice(0, 4000),
              retryCount: row.attempts,
              lastKnownState: row.status,
              failedAt: new Date()
            }
          });
          await tx.analyticsProjectionQueue.delete({ where: { id: queueId } });
        })
      );
      void emitServerEvent({
        event: "event_moved_to_dlq",
        payload: { eventId: row.eventId, retryCount: row.attempts, reason: "non_transient" }
      });
      publishObservabilitySignal({
        type: "dlq_growth",
        severity: "error",
        payload: { eventId: row.eventId, reason: "non_transient" }
      });
      return;
    }
    const terminal = nextAttempts >= MAX_RETRIES;
    if (terminal) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack ?? "" : "";
      await safeDbResult(() =>
        prisma.$transaction(async (tx) => {
          await tx.analyticsProjectionDeadLetterQueue.upsert({
            where: { eventId: row.eventId },
            create: {
              eventId: row.eventId,
              error: msg.slice(0, 4000),
              stackTrace: stack.slice(0, 4000),
              retryCount: nextAttempts,
              lastKnownState: row.status
            },
            update: {
              error: msg.slice(0, 4000),
              stackTrace: stack.slice(0, 4000),
              retryCount: nextAttempts,
              lastKnownState: row.status,
              failedAt: new Date()
            }
          });
          await tx.analyticsProjectionQueue.delete({ where: { id: queueId } });
        })
      );
      void emitServerEvent({
        event: "event_moved_to_dlq",
        payload: { eventId: row.eventId, retryCount: nextAttempts, reason: "max_retries" }
      });
      publishObservabilitySignal({
        type: "dlq_growth",
        severity: "error",
        payload: { eventId: row.eventId, reason: "max_retries" }
      });
      return;
    }
    await safeDbResult(() =>
      prisma.analyticsProjectionQueue.update({
        where: { id: queueId },
        data: {
          attempts: nextAttempts,
          status: "pending",
          availableAt: new Date(Date.now() + backoffMs(nextAttempts)),
          lastError: error instanceof Error ? error.message : String(error)
        }
      })
    );
  }
}

export async function processProjectionQueueBatch(limit = 25): Promise<number> {
  const fenceAllowed = await isWriteAllowed("worker");
  if (!fenceAllowed) {
    return 0;
  }
  const localRegion = getActiveRegion();
  const localNamespace = `queue_${localRegion}`;
  const costGate = await canExecute("projection_worker");
  if (!costGate.allowed) {
    return 0;
  }
  const guard = assertSystemAllowed("projection_worker");
  if (!guard.allowed) {
    return 0;
  }
  if (guard.state.systemMode === "degraded") {
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }
  await injectFailure("worker_slowdown");
  return withCircuitBreaker(
    "projection_worker",
    async () => {
  const expiredRes = await safeDbResult(() =>
    prisma.analyticsProjectionQueue.updateMany({
      where: { status: "pending", expiresAt: { lt: new Date() } },
      data: { status: "expired", lastError: "queue_item_expired" }
    })
  );
  if (!expiredRes.ok) {
    return 0;
  }

  const priorityOrder: Array<"HIGH" | "NORMAL" | "LOW"> = ["HIGH", "NORMAL", "LOW"];
  const jobs: Array<{ id: string }> = [];
  for (const p of priorityOrder) {
    if (jobs.length >= limit) {
      break;
    }
    // eslint-disable-next-line no-await-in-loop
    const rowsRes = await safeDbResult(() =>
      prisma.analyticsProjectionQueue.findMany({
        where: { status: "pending", priority: p, availableAt: { lte: new Date() } },
        orderBy: { createdAt: "asc" },
        take: limit - jobs.length
      })
    );
    if (!rowsRes.ok) {
      continue;
    }
    const rows = rowsRes.value;
    const localRows = rows.filter((r) => {
      const ns = getQueueNamespace(r.eventId);
      return ns == null || ns === localNamespace;
    });
    jobs.push(...localRows.map((r) => ({ id: r.id })));
  }

  const lockIds: string[] = [];
  for (const job of jobs) {
    // eslint-disable-next-line no-await-in-loop
    const lockRes = await safeDbResult(() =>
      prisma.analyticsProjectionQueue.updateMany({
        where: { id: job.id, status: "pending" },
        data: { status: "processing" }
      })
    );
    if (lockRes.ok && lockRes.value.count > 0) {
      lockIds.push(job.id);
    }
  }
  if (lockIds.length === 0) {
    return 0;
  }

  let processed = 0;
  const pressure = getCurrentCostPressure();
  const baseConcurrency = maxConcurrency();
  const concurrency = pressure >= 90 ? 1 : pressure >= 75 ? Math.max(1, Math.floor(baseConcurrency / 2)) : baseConcurrency;
  for (let i = 0; i < lockIds.length; i += concurrency) {
    const slice = lockIds.slice(i, i + concurrency);
    await Promise.all(
      slice.map(async (id) => {
        await processProjectionQueueItem(id);
        trackCost("projectionJobs", 1);
        processed += 1;
      })
    );
  }
  return processed;
    },
    async () => 0
  );
}
