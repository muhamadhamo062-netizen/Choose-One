import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { isLifecycleEvent, validateLifecycleTransition, type AnalyticsLifecycleEvent } from "@/lib/analytics/event-state-machine";
import { detectReplayAnomalies } from "@/lib/analytics/replay-anomaly-detector";
import { getReplayCursor, getTimeTravelSnapshots } from "@/lib/analytics/time-travel-snapshots";
import { withCircuitBreaker } from "@/lib/analytics/circuit-breaker";
import { injectFailure } from "@/lib/analytics/failure-injection";
import { assertSystemAllowed } from "@/lib/analytics/system-control-plane";
import { isWriteAllowed } from "@/lib/analytics/global-write-fence";
import { getActiveRegion, getRegionSchemaVersion } from "@/lib/analytics/region/region-context";
import { upcastEvent } from "@/lib/analytics/schema/event-upcaster";
import { isCompatible } from "@/lib/analytics/schema/event-schema-registry";
import { recordSchemaDrift } from "@/lib/analytics/schema/schema-drift-detector";
import { canExecute } from "@/lib/analytics/cost/cost-governor";
import { trackCost } from "@/lib/analytics/cost/cost-meter";

type ReplayState = {
  lifecycleState: string | null;
  totalSourcesFound: number;
  verificationStatus: string | null;
  eventCount: number;
};

function hashState(state: ReplayState): string {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex");
}

export async function replayScan(scanId: string, options?: { strictReplay?: boolean }) {
  const costGate = await canExecute("replay");
  if (!costGate.allowed) {
    return {
      scanId,
      timeline: [],
      finalState: {
        lifecycleState: null,
        totalSourcesFound: 0,
        verificationStatus: null,
        eventCount: 0,
        replayHash: ""
      },
      reconstructedMetrics: {
        scans: 0,
        sourcesFound: 0,
        removalsRequested: 0,
        verifiedRemovals: 0,
        pending: 0
      },
      stateTransitions: [],
      mismatch: {
        materializedExists: false,
        materializedHash: null,
        replayHash: "",
        matches: true
      },
      anomalies: [],
      partialReplay: true,
      snapshots: []
    };
  }
  const replayFenceAllowed = await isWriteAllowed("replay");
  if (!replayFenceAllowed) {
    return {
      scanId,
      timeline: [],
      finalState: {
        lifecycleState: null,
        totalSourcesFound: 0,
        verificationStatus: null,
        eventCount: 0,
        replayHash: ""
      },
      reconstructedMetrics: {
        scans: 0,
        sourcesFound: 0,
        removalsRequested: 0,
        verifiedRemovals: 0,
        pending: 0
      },
      stateTransitions: [],
      mismatch: {
        materializedExists: false,
        materializedHash: null,
        replayHash: "",
        matches: true
      },
      anomalies: [],
      partialReplay: true,
      snapshots: []
    };
  }
  const guard = assertSystemAllowed("replay");
  if (!guard.allowed) {
    return {
      scanId,
      timeline: [],
      finalState: {
        lifecycleState: null,
        totalSourcesFound: 0,
        verificationStatus: null,
        eventCount: 0,
        replayHash: ""
      },
      reconstructedMetrics: {
        scans: 0,
        sourcesFound: 0,
        removalsRequested: 0,
        verifiedRemovals: 0,
        pending: 0
      },
      stateTransitions: [],
      mismatch: {
        materializedExists: false,
        materializedHash: null,
        replayHash: "",
        matches: true
      },
      anomalies: [],
      partialReplay: true,
      snapshots: []
    };
  }
  await injectFailure("db_latency");
  trackCost("replayExecutions", 1);
  const strictReplay = options?.strictReplay === true;
  const localSchemaVersion = getRegionSchemaVersion(getActiveRegion());
  return withCircuitBreaker(
    "replay_engine",
    async () => {
  const [events, cursor, materialized, snapshots] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: { scanId },
      orderBy: { createdAt: "asc" }
    }),
    getReplayCursor(scanId),
    prisma.analyticsMaterializedScan.findUnique({ where: { scanId } }),
    getTimeTravelSnapshots(scanId)
  ]);

  const startAt = 0;
  const deadline = Date.now() + 5000;
  let partialReplay = false;
  const state: ReplayState = {
    lifecycleState: cursor.lastState ?? null,
    totalSourcesFound: 0,
    verificationStatus: null,
    eventCount: 0
  };
  const timeline: Array<{ eventId: string; type: string; timestamp: string; stateAfter: ReplayState }> = [];
  let prevLifecycle = (cursor.lastState && isLifecycleEvent(cursor.lastState) ? cursor.lastState : null) as AnalyticsLifecycleEvent | null;

  for (let i = startAt; i < events.length; i += 1) {
    if (Date.now() > deadline) {
      partialReplay = true;
      break;
    }
    const ev = events[i]!;
    const upcasted = upcastEvent(
      {
        type: ev.type,
        metadata: (ev.metadata as Record<string, unknown>) ?? {}
      },
      localSchemaVersion
    );
    const incomingVersion = Number(((ev.metadata as Record<string, unknown>)?.eventVersion ?? 1));
    const compatible = isCompatible(incomingVersion, localSchemaVersion);
    if (!compatible) {
      recordSchemaDrift({
        region: getActiveRegion(),
        expected: localSchemaVersion,
        actual: incomingVersion,
        type: ev.type
      });
      if (strictReplay) {
        continue;
      }
    }
    state.eventCount += 1;
    if (ev.type === "discovery_found") {
      const n = Number((upcasted.metadata as { sourcesFound?: unknown })?.sourcesFound ?? 0);
      if (n > 0) {
        state.totalSourcesFound += n;
      }
    }
    if (isLifecycleEvent(ev.type)) {
      const check = validateLifecycleTransition(prevLifecycle, ev.type);
      if (check.ok) {
        prevLifecycle = ev.type;
        state.lifecycleState = ev.type;
        if (
          ev.type === "verification_started" ||
          ev.type === "verification_completed" ||
          ev.type === "verified_deleted" ||
          ev.type === "partial_deleted" ||
          ev.type === "not_confirmed"
        ) {
          state.verificationStatus = ev.type;
        }
      }
    }
    timeline.push({
      eventId: ev.eventId,
      type: ev.type,
      timestamp: ev.createdAt.toISOString(),
      stateAfter: { ...state }
    });

  }

  const reconstructedMetrics = {
    scans: state.lifecycleState ? 1 : 0,
    sourcesFound: state.totalSourcesFound,
    removalsRequested: events.filter((e) => e.type === "removal_requested").length,
    verifiedRemovals: state.verificationStatus === "verified_deleted" ? 1 : 0,
    pending: state.verificationStatus === "verification_started" ? 1 : 0
  };

  const replayHash = hashState(state);
  const materializedHash =
    materialized == null
      ? null
      : hashState({
          lifecycleState: null,
          totalSourcesFound: materialized.sourcesFound,
          verificationStatus: materialized.verificationStatus,
          eventCount: materialized.eventCount
        });

  const expectedFlow = [
    "scan_created",
    "scan_completed",
    "discovery_found",
    "verification_started",
    "verification_completed"
  ];
  const anomaly = detectReplayAnomalies({
    expectedFlow,
    eventTypes: events.map((e) => e.type),
    eventIds: events.map((e) => e.eventId),
    materializedHash,
    replayHash
  });

  return {
    scanId,
    timeline,
    finalState: {
      ...state,
      replayHash
    },
    reconstructedMetrics,
    stateTransitions: timeline.map((t) => ({ eventId: t.eventId, type: t.type, stateAfter: t.stateAfter.lifecycleState })),
    mismatch: {
      materializedExists: Boolean(materialized),
      materializedHash,
      replayHash,
      matches: materializedHash ? materializedHash === replayHash : true
    },
    anomalies: anomaly.anomalies,
    partialReplay,
    snapshots: snapshots.map((s) => ({
      id: s.id,
      eventId: s.eventId,
      eventType: s.eventType,
      eventCursor: s.eventCursor,
      derivedStateHash: s.derivedStateHash,
      snapshotHash: s.snapshotHash,
      createdAt: s.createdAt.toISOString()
    }))
  };
    },
    async () => ({
      scanId,
      timeline: [],
      finalState: {
        lifecycleState: null,
        totalSourcesFound: 0,
        verificationStatus: null,
        eventCount: 0,
        replayHash: ""
      },
      reconstructedMetrics: {
        scans: 0,
        sourcesFound: 0,
        removalsRequested: 0,
        verifiedRemovals: 0,
        pending: 0
      },
      stateTransitions: [],
      mismatch: {
        materializedExists: false,
        materializedHash: null,
        replayHash: "",
        matches: true
      },
      anomalies: [
        {
          type: "invalid_state_jump",
          severity: "high",
          description: "Replay engine circuit is open; returned safe fallback."
        }
      ],
      partialReplay: true,
      snapshots: []
    })
  );
}
