export type ReplayAnomaly = {
  type: "missing_event" | "duplicate_transition" | "invalid_state_jump" | "materialized_drift";
  severity: "low" | "medium" | "high";
  eventId?: string;
  description: string;
};

export function detectReplayAnomalies(input: {
  expectedFlow: string[];
  eventTypes: string[];
  eventIds: string[];
  materializedHash?: string | null;
  replayHash?: string | null;
}): { anomalies: ReplayAnomaly[] } {
  const anomalies: ReplayAnomaly[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < input.eventTypes.length; i += 1) {
    const current = input.eventTypes[i]!;
    const prev = i > 0 ? input.eventTypes[i - 1]! : null;
    if (prev === current && current !== "event_rejected") {
      anomalies.push({
        type: "duplicate_transition",
        severity: "medium",
        eventId: input.eventIds[i],
        description: `Duplicate transition detected for '${current}'.`
      });
    }
    seen.add(current);
  }

  for (const required of input.expectedFlow) {
    if (!seen.has(required)) {
      anomalies.push({
        type: "missing_event",
        severity: "high",
        description: `Missing required lifecycle event '${required}'.`
      });
    }
  }

  const rank: Record<string, number> = {
    scan_created: 0,
    scan_completed: 1,
    discovery_found: 2,
    verification_started: 3,
    verification_completed: 4,
    verified_deleted: 5,
    partial_deleted: 5,
    not_confirmed: 5
  };
  for (let i = 1; i < input.eventTypes.length; i += 1) {
    const prev = input.eventTypes[i - 1]!;
    const cur = input.eventTypes[i]!;
    if (rank[prev] != null && rank[cur] != null && rank[cur] < rank[prev]) {
      anomalies.push({
        type: "invalid_state_jump",
        severity: "high",
        eventId: input.eventIds[i],
        description: `Invalid backward state jump '${prev}' -> '${cur}'.`
      });
    }
  }

  if (input.materializedHash && input.replayHash && input.materializedHash !== input.replayHash) {
    anomalies.push({
      type: "materialized_drift",
      severity: "high",
      description: "Materialized projection hash does not match replayed state hash."
    });
  }

  return { anomalies };
}
