import { prisma } from "@/lib/prisma";
import { processProjectionQueueBatch, processProjectionQueueItem } from "@/lib/workers/analytics-projection-worker";
import { emitServerEvent } from "@/lib/events/event-emitter";
import { injectFailure } from "@/lib/analytics/failure-injection";
import { assertSystemAllowed } from "@/lib/analytics/system-control-plane";
import { publishObservabilitySignal } from "@/lib/analytics/observability-bus";
import { isWriteAllowed } from "@/lib/analytics/global-write-fence";
import { getActiveRegion } from "@/lib/analytics/region/region-context";
import { canExecute } from "@/lib/analytics/cost/cost-governor";
import { trackCost } from "@/lib/analytics/cost/cost-meter";
import { safeDbResult } from "@/lib/safe-db";

let drainScheduled = false;
const DEFAULT_TTL_MINUTES = 30;
const BACKPRESSURE_THRESHOLD = 1000;
const queueNamespaces = new Map<string, string>();

type QueuePriority = "HIGH" | "NORMAL" | "LOW";

function queuePriorityForType(type: string): QueuePriority {
  if (
    type === "scan_completed" ||
    type === "verification_completed" ||
    type === "verified_deleted" ||
    type === "partial_deleted" ||
    type === "not_confirmed"
  ) {
    return "HIGH";
  }
  if (type === "discovery_found" || type === "scan_created") {
    return "NORMAL";
  }
  return "LOW";
}

function ttlMinutes(): number {
  const raw = Number(process.env.ANALYTICS_QUEUE_TTL_MINUTES ?? "");
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_TTL_MINUTES;
  }
  return Math.floor(raw);
}

function scheduleLocalDrain(): void {
  if (drainScheduled) {
    return;
  }
  drainScheduled = true;
  queueMicrotask(() => {
    drainScheduled = false;
    void processProjectionQueueBatch(15).catch(() => {
      // Queue is durable in DB; failures are retried by worker/cron.
    });
  });
}

export async function enqueueEvent(eventId: string, opts?: { region?: string; namespace?: string }): Promise<void> {
  const fenceAllowed = await isWriteAllowed("api");
  if (!fenceAllowed) {
    return;
  }
  const guard = assertSystemAllowed("projection_enqueue");
  if (!guard.allowed) {
    return;
  }
  const costGate = await canExecute("projection_enqueue");
  if (!costGate.allowed) {
    return;
  }
  await injectFailure("queue_delay");
  trackCost("queueOps", 1);
  const evRes = await safeDbResult(() =>
    prisma.analyticsEvent.findUnique({
      where: { eventId },
      select: { type: true }
    })
  );
  if (!evRes.ok || !evRes.value) {
    return;
  }
  const ev = evRes.value;
  const priority = queuePriorityForType(ev.type);
  const now = Date.now();
  const expiresAt = new Date(now + ttlMinutes() * 60 * 1000);
  let availableAt = new Date(now);
  const depthRes = await safeDbResult(() =>
    prisma.analyticsProjectionQueue.count({
      where: { status: { in: ["pending", "processing"] } }
    })
  );
  if (!depthRes.ok) {
    return;
  }
  const depth = depthRes.value;
  if (depth > BACKPRESSURE_THRESHOLD) {
    availableAt = new Date(now + 1500);
    void emitServerEvent({
      event: "QUEUE_BACKPRESSURE_ACTIVE",
      payload: {
        queueDepth: depth,
        eventId,
        priority
      }
    }).catch(() => {
      // best effort
    });
    publishObservabilitySignal({
      type: "queue_backpressure_spike",
      severity: "warn",
      payload: { queueDepth: depth }
    });
  }
  const upRes = await safeDbResult(() =>
    prisma.analyticsProjectionQueue.upsert({
      where: { eventId },
      create: {
        eventId,
        priority,
        status: "pending",
        availableAt,
        expiresAt
      },
      update: {
        priority,
        status: "pending",
        availableAt,
        expiresAt
      }
    })
  );
  if (!upRes.ok) {
    return;
  }
  trackCost("dbWrites", 1);
  const region = opts?.region ?? getActiveRegion();
  const namespace = opts?.namespace ?? `queue_${region}`;
  queueNamespaces.set(eventId, namespace);
  scheduleLocalDrain();
}

export function getQueueNamespace(eventId: string): string | null {
  return queueNamespaces.get(eventId) ?? null;
}

export function getQueueDistribution(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of queueNamespaces.values()) {
    out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}

export async function processEvent(eventId: string): Promise<void> {
  const rowRes = await safeDbResult(() => prisma.analyticsProjectionQueue.findUnique({ where: { eventId } }));
  if (!rowRes.ok || !rowRes.value) {
    return;
  }
  const row = rowRes.value;
  const lockRes = await safeDbResult(() =>
    prisma.analyticsProjectionQueue.updateMany({
      where: { id: row.id, status: "pending" },
      data: { status: "processing" }
    })
  );
  if (!lockRes.ok || lockRes.value.count === 0) {
    return;
  }
  await processProjectionQueueItem(row.id);
}

export async function retryFailedEvents(limit = 50): Promise<number> {
  const rowsRes = await safeDbResult(() =>
    prisma.analyticsProjectionQueue.findMany({
      where: { status: "failed" },
      orderBy: { createdAt: "asc" },
      take: limit
    })
  );
  if (!rowsRes.ok) {
    return 0;
  }
  const rows = rowsRes.value;
  if (rows.length === 0) {
    return 0;
  }
  const upd = await safeDbResult(() =>
    prisma.analyticsProjectionQueue.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: {
        status: "pending",
        availableAt: new Date()
      }
    })
  );
  if (!upd.ok) {
    return 0;
  }
  scheduleLocalDrain();
  return rows.length;
}

export async function getProjectionQueueDepths(): Promise<{
  queue_depth_high: number;
  queue_depth_normal: number;
  queue_depth_low: number;
  dlq_count: number;
  expired_events_count: number;
}> {
  const batch = await safeDbResult(() =>
    Promise.all([
      prisma.analyticsProjectionQueue.count({ where: { status: { in: ["pending", "processing"] }, priority: "HIGH" } }),
      prisma.analyticsProjectionQueue.count({ where: { status: { in: ["pending", "processing"] }, priority: "NORMAL" } }),
      prisma.analyticsProjectionQueue.count({ where: { status: { in: ["pending", "processing"] }, priority: "LOW" } }),
      prisma.analyticsProjectionDeadLetterQueue.count(),
      prisma.analyticsProjectionQueue.count({ where: { status: { in: ["expired", "skipped_expired"] } } })
    ])
  );
  if (!batch.ok) {
    return {
      queue_depth_high: 0,
      queue_depth_normal: 0,
      queue_depth_low: 0,
      dlq_count: 0,
      expired_events_count: 0
    };
  }
  const [high, normal, low, dlq, expired] = batch.value;
  return {
    queue_depth_high: high,
    queue_depth_normal: normal,
    queue_depth_low: low,
    dlq_count: dlq,
    expired_events_count: expired
  };
}
