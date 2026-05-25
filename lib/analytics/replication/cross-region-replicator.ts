import { prisma } from "@/lib/prisma";
import { safeDbResult } from "@/lib/safe-db";
import { publishObservabilitySignal } from "@/lib/analytics/observability-bus";
import { updateRegionHealth } from "@/lib/analytics/region/region-health-monitor";
import { getRegionSchemaVersion } from "@/lib/analytics/region/region-context";
import { upcastEvent } from "@/lib/analytics/schema/event-upcaster";
import { hashSchema, isCompatible } from "@/lib/analytics/schema/event-schema-registry";
import { recordSchemaDrift } from "@/lib/analytics/schema/schema-drift-detector";
import { canExecute } from "@/lib/analytics/cost/cost-governor";
import { trackCost } from "@/lib/analytics/cost/cost-meter";

export async function replicateEvent(
  event: { eventId: string; scanId?: string | null; userId?: string | null; type: string; metadata?: Record<string, unknown> },
  sourceRegion: string,
  targetRegion: string
): Promise<void> {
  queueMicrotask(() => {
    void (async () => {
      const started = Date.now();
      try {
        const gate = await canExecute("replication");
        if (!gate.allowed) {
          return;
        }
        const targetVersion = getRegionSchemaVersion(targetRegion);
        const incomingVersion = Number(event.metadata?.eventVersion ?? 1);
        if (!isCompatible(incomingVersion, targetVersion)) {
          recordSchemaDrift({
            region: targetRegion,
            expected: targetVersion,
            actual: incomingVersion,
            type: event.type
          });
        }
        const upcasted = upcastEvent(
          {
            type: event.type,
            metadata: event.metadata ?? {}
          },
          targetVersion
        );
        const metadata = {
          ...upcasted.metadata,
          schemaHash: typeof upcasted.metadata.schemaHash === "string"
            ? upcasted.metadata.schemaHash
            : hashSchema({ type: event.type, targetVersion }),
          replication: {
            sourceRegion,
            targetRegion,
            replicatedAt: new Date().toISOString()
          }
        };
        const up = await safeDbResult(() =>
          prisma.analyticsEvent.upsert({
            where: { eventId: event.eventId },
            create: {
              eventId: event.eventId,
              scanId: event.scanId ?? null,
              userId: event.userId ?? null,
              type: event.type,
              metadata
            },
            update: {}
          })
        );
        if (!up.ok) {
          throw new Error("replication_upsert_failed");
        }
        trackCost("replicationEvents", 1);
        trackCost("dbWrites", 1);
        updateRegionHealth(targetRegion, {
          replicationLagMs: Date.now() - started,
          healthy: true
        });
      } catch {
        updateRegionHealth(targetRegion, {
          replicationLagMs: Date.now() - started,
          healthy: false
        });
        publishObservabilitySignal({
          type: "cross_region_replication_failed",
          severity: "warn",
          payload: { eventId: event.eventId, sourceRegion, targetRegion }
        });
      }
    })();
  });
}
