import type { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { isLifecycleEvent, validateLifecycleTransition, type AnalyticsLifecycleEvent } from "@/lib/analytics/event-state-machine";
import { enqueueEvent } from "@/lib/analytics/event-queue";
import { withCircuitBreaker } from "@/lib/analytics/circuit-breaker";
import { injectFailure } from "@/lib/analytics/failure-injection";
import { assertSystemAllowed } from "@/lib/analytics/system-control-plane";
import { publishObservabilitySignal } from "@/lib/analytics/observability-bus";
import { isWriteAllowed } from "@/lib/analytics/global-write-fence";
import { attachRegionToEvent, getActiveRegion, getFailoverRegion, isPrimaryRegion } from "@/lib/analytics/region/region-context";
import { isRegionHealthy } from "@/lib/analytics/region/region-health-monitor";
import { assignLogicalOrdering } from "@/lib/analytics/replication/global-ordering";
import { replicateEvent } from "@/lib/analytics/replication/cross-region-replicator";
import { hashSchema, registerEventSchema, resolveLatestCompatibleSchema } from "@/lib/analytics/schema/event-schema-registry";
import { canExecute } from "@/lib/analytics/cost/cost-governor";
import { trackCost } from "@/lib/analytics/cost/cost-meter";
import { safeDbResult } from "@/lib/safe-db";

export const ANALYTICS_EVENT_TYPES = [
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
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

for (const t of ANALYTICS_EVENT_TYPES) {
  registerEventSchema(t, 1, {
    type: t,
    metadataFields: ["eventVersion", "schemaVersion", "schemaHash", "region", "ordering"]
  });
}

const DEFAULT_DEDUPE_WINDOW_MINUTES = 2;

function dedupeWindowMinutes(): number {
  const raw = Number(process.env.ANALYTICS_EVENT_DEDUPE_MINUTES ?? "");
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_DEDUPE_WINDOW_MINUTES;
  }
  return Math.floor(raw);
}

function buildEventId(input: { scanId?: string | null; type: string }): string {
  const windowMs = dedupeWindowMinutes() * 60 * 1000;
  const bucket = Math.floor(Date.now() / windowMs);
  const basis = `${input.scanId ?? "global"}:${input.type}:${bucket}`;
  return createHash("sha256").update(basis).digest("hex");
}

async function writeRejectedEvent(input: {
  scanId?: string | null;
  userId?: string | null;
  eventType: string;
  reason: "duplicate_event" | "invalid_sequence";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const eventId = randomUUID();
  const activeRegion = getActiveRegion();
  const ordered = assignLogicalOrdering(input.scanId ?? null, activeRegion);
  const metadata = {
    rejectedType: input.eventType,
    reason: input.reason,
    timestamp: new Date().toISOString(),
    region: activeRegion,
    ordering: ordered,
    eventVersion: 1,
    schemaVersion: "v1",
    schemaHash: hashSchema({ type: input.eventType, metadataVersion: 1 }),
    ...(input.metadata ?? {})
  };
  const wr = await safeDbResult(() =>
    prisma.analyticsEvent.create({
      data: {
        eventId,
        type: "event_rejected",
        userId: input.userId ?? null,
        scanId: input.scanId ?? null,
        metadata: metadata as Prisma.InputJsonValue
      }
    })
  );
  if (wr.ok) {
    trackCost("dbWrites", 1);
  }
  void enqueueEvent(eventId).catch(() => {
    // Best-effort async projection enqueue; source of truth is analytics_events.
  });
}

export async function trackAnalyticsEvent(input: {
  type: AnalyticsEventType;
  userId?: string | null;
  scanId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true; eventId: string } | { ok: false; error: "invalid_event_sequence" | "duplicate_event" }> {
  const fenceAllowed = await isWriteAllowed("api");
  if (!fenceAllowed) {
    return { ok: false, error: "duplicate_event" };
  }
  const guard = assertSystemAllowed("analytics_write");
  if (!guard.allowed) {
    return { ok: false, error: "duplicate_event" };
  }
  await injectFailure("db_latency");
  const drop = await injectFailure("event_loss");
  if (drop.dropped) {
    return { ok: false, error: "duplicate_event" };
  }
  const eventId = buildEventId({ scanId: input.scanId ?? null, type: input.type });
  const dedupeSince = new Date(Date.now() - dedupeWindowMinutes() * 60 * 1000);
  if (input.scanId && input.type !== "event_rejected") {
    trackCost("dbReads", 1);
    const dupRes = await safeDbResult(() =>
      prisma.analyticsEvent.findFirst({
        where: {
          scanId: input.scanId,
          type: input.type,
          createdAt: { gte: dedupeSince }
        },
        orderBy: { createdAt: "desc" }
      })
    );
    if (!dupRes.ok) {
      return { ok: false, error: "duplicate_event" };
    }
    const duplicate = dupRes.value;
    if (duplicate) {
      // eslint-disable-next-line no-console
      console.warn("[analytics-events] duplicate_event", { scanId: input.scanId, type: input.type });
      await writeRejectedEvent({
        scanId: input.scanId,
        userId: input.userId ?? null,
        eventType: input.type,
        reason: "duplicate_event"
      });
      return { ok: false, error: "duplicate_event" };
    }
  }

  if (input.scanId && isLifecycleEvent(input.type)) {
    trackCost("dbReads", 1);
    const lastRes = await safeDbResult(() =>
      prisma.analyticsEvent.findFirst({
        where: {
          scanId: input.scanId,
          type: { in: [...ANALYTICS_EVENT_TYPES.filter((t) => isLifecycleEvent(t))] }
        },
        orderBy: { createdAt: "desc" }
      })
    );
    if (!lastRes.ok) {
      return { ok: false, error: "invalid_event_sequence" };
    }
    const lastLifecycle = lastRes.value;
    const prevType = lastLifecycle?.type && isLifecycleEvent(lastLifecycle.type)
      ? (lastLifecycle.type as AnalyticsLifecycleEvent)
      : null;
    const transition = validateLifecycleTransition(prevType, input.type);
    if (!transition.ok) {
      // eslint-disable-next-line no-console
      console.warn("[analytics-events] invalid_event_sequence", {
        scanId: input.scanId,
        type: input.type,
        previous: prevType
      });
      await writeRejectedEvent({
        scanId: input.scanId,
        userId: input.userId ?? null,
        eventType: input.type,
        reason: "invalid_sequence"
      });
      return { ok: false, error: "invalid_event_sequence" };
    }
  }

  const metadata = input.metadata ?? {};
  const activeRegion = getActiveRegion();
  const ordering = assignLogicalOrdering(input.scanId ?? null, activeRegion);
  const regionTagged = attachRegionToEvent({ metadata }, activeRegion).metadata ?? {};
  const latestSchema = resolveLatestCompatibleSchema(input.type, 1) ?? resolveLatestCompatibleSchema("default", 1);
  const costGate = await canExecute("analytics_write");
  if (costGate.throttled) {
    publishObservabilitySignal({
      type: "cost_write_throttled",
      severity: "warn",
      payload: { operation: "analytics_write", delayMs: costGate.delayMs }
    });
  }
  const inserted = await withCircuitBreaker(
    "analytics_events_write",
    async () => {
      const cr = await safeDbResult(() =>
        prisma.analyticsEvent.create({
          data: {
            eventId,
            type: input.type,
            userId: input.userId ?? null,
            scanId: input.scanId ?? null,
            metadata: {
              ...regionTagged,
              ordering,
              eventVersion: 1,
              schemaVersion: latestSchema?.schemaVersion ?? "v1",
              schemaHash: latestSchema?.schemaHash ?? hashSchema({ type: input.type, metadataVersion: 1 })
            } as Prisma.InputJsonValue
          }
        })
      );
      if (!cr.ok) {
        return false;
      }
      trackCost("dbWrites", 1);
      return true;
    },
    async () => false
  );
  if (!inserted) {
    publishObservabilitySignal({
      type: "analytics_write_failed_fast",
      severity: "warn",
      payload: { type: input.type, scanId: input.scanId ?? null }
    });
    return { ok: false, error: "duplicate_event" };
  }
  const primaryHealthy = isPrimaryRegion(activeRegion) && isRegionHealthy(activeRegion);
  const targetRegion = primaryHealthy ? activeRegion : getFailoverRegion(activeRegion);
  if (!primaryHealthy) {
    publishObservabilitySignal({
      type: "region_write_failover_forwarded",
      severity: "warn",
      payload: { fromRegion: activeRegion, toRegion: targetRegion, eventId }
    });
  }
  void enqueueEvent(eventId, { region: targetRegion, namespace: `queue_${targetRegion}` }).catch(() => {
    // Best-effort async projection enqueue; source of truth is analytics_events.
  });
  if (targetRegion !== activeRegion) {
    void replicateEvent(
      { eventId, scanId: input.scanId ?? null, userId: input.userId ?? null, type: input.type, metadata: regionTagged },
      activeRegion,
      targetRegion
    );
  }
  return { ok: true, eventId };
}
