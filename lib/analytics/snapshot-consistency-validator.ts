import { replayScan } from "@/lib/analytics/replay-engine";
import { getTimeTravelSnapshots } from "@/lib/analytics/time-travel-snapshots";
import { createHash } from "crypto";
import { publishObservabilitySignal } from "@/lib/analytics/observability-bus";
import { reportDriftScore } from "@/lib/analytics/global-write-fence";

type SnapshotMismatch = {
  kind: "stateMismatch" | "metricDriftDelta" | "eventSequenceHashMismatch";
  description: string;
  expected: unknown;
  actual: unknown;
};

export async function validateSnapshotAgainstReplay(scanId: string): Promise<{
  isConsistent: boolean;
  driftScore: number;
  mismatches: SnapshotMismatch[];
  replay: Awaited<ReturnType<typeof replayScan>>;
  latestSnapshot: {
    id: string;
    eventId: string;
    eventType: string;
    eventCursor: number;
    derivedStateHash: string;
    snapshotHash: string;
    createdAt: string;
  } | null;
}> {
  const replay = await replayScan(scanId);
  const snapshots = await getTimeTravelSnapshots(scanId);
  const latest = snapshots.at(-1) ?? null;
  const mismatches: SnapshotMismatch[] = [];

  if (!latest) {
    mismatches.push({
      kind: "stateMismatch",
      description: "No time-travel snapshot exists for this scan.",
      expected: "snapshot",
      actual: "missing"
    });
  } else {
    if (latest.derivedStateHash !== replay.finalState.replayHash) {
      mismatches.push({
        kind: "stateMismatch",
        description: "Latest snapshot state hash does not match replayed final state hash.",
        expected: latest.derivedStateHash,
        actual: replay.finalState.replayHash
      });
    }
    const replayTimelineHash = replay.timeline
      .map((t) => `${t.eventId}:${t.type}:${t.timestamp}`)
      .join("|");
    const replaySequenceHash = createHash("sha256").update(replayTimelineHash).digest("hex");
    if (latest.snapshotHash !== replaySequenceHash) {
      mismatches.push({
        kind: "eventSequenceHashMismatch",
        description: "Snapshot event sequence hash differs from replay event sequence hash.",
        expected: latest.snapshotHash,
        actual: replaySequenceHash
      });
    }
    const snapshotState = latest.materializedState as { sourcesFound?: number; eventCount?: number };
    const metricDelta =
      Math.abs((snapshotState.sourcesFound ?? 0) - replay.reconstructedMetrics.sourcesFound) +
      Math.abs((snapshotState.eventCount ?? 0) - replay.finalState.eventCount);
    if (metricDelta > 0) {
      mismatches.push({
        kind: "metricDriftDelta",
        description: "Snapshot metrics differ from replayed metrics.",
        expected: snapshotState,
        actual: {
          sourcesFound: replay.reconstructedMetrics.sourcesFound,
          eventCount: replay.finalState.eventCount
        }
      });
    }
  }

  const driftScore = Math.min(100, mismatches.length * 34);
  if (mismatches.length > 0) {
    publishObservabilitySignal({
      type: "snapshot_inconsistency",
      severity: "error",
      payload: { scanId, driftScore, mismatchCount: mismatches.length }
    });
  }
  await reportDriftScore(driftScore);
  return {
    isConsistent: mismatches.length === 0,
    driftScore,
    mismatches,
    replay,
    latestSnapshot: latest
      ? {
          id: latest.id,
          eventId: latest.eventId,
          eventType: latest.eventType,
          eventCursor: latest.eventCursor,
          derivedStateHash: latest.derivedStateHash,
          snapshotHash: latest.snapshotHash,
          createdAt: latest.createdAt.toISOString()
        }
      : null
  };
}
