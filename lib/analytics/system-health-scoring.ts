import { prisma } from "@/lib/prisma";
import { runConsistencyCheck } from "@/lib/analytics/consistency-checker";
import { validateSnapshotAgainstReplay } from "@/lib/analytics/snapshot-consistency-validator";
import { reportHealthScore } from "@/lib/analytics/global-write-fence";
import { detectOscillation, getStabilityScore } from "@/lib/analytics/system-stability-governor";
import { getBudgetSnapshot } from "@/lib/analytics/observability-budget";

export type SystemHealthStatus = "healthy" | "degraded" | "critical";

export type SystemHealthReport = {
  score: number;
  status: SystemHealthStatus;
  components: {
    replayDrift: number;
    queueBacklog: number;
    dlqSize: number;
    rejectionRatePct: number;
    snapshotConsistencyPenalty: number;
    stabilityPenalty: number;
    budgetPressurePenalty: number;
  };
  details: {
    checkedScanId: string | null;
    driftScore: number;
    queueDepthHigh: number;
    queueDepthNormal: number;
    queueDepthLow: number;
    dlqCount: number;
    rejectedEvents: number;
    totalEvents: number;
    snapshotConsistent: boolean | null;
    stabilityScore: number;
    oscillationDetected: boolean;
    signalDropRate: number;
    compressedSignalCount: number;
    budgetPressureScore: number;
  };
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function statusFromScore(score: number): SystemHealthStatus {
  if (score >= 80) {
    return "healthy";
  }
  if (score >= 50) {
    return "degraded";
  }
  return "critical";
}

export async function computeSystemHealthReport(): Promise<SystemHealthReport> {
  const consistency = await runConsistencyCheck();
  const [rejectedEvents, totalEvents, latestSnapshot] = await Promise.all([
    prisma.analyticsEvent.count({ where: { type: "event_rejected" } }),
    prisma.analyticsEvent.count(),
    prisma.analyticsTimeTravelSnapshot.findFirst({
      orderBy: { createdAt: "desc" },
      select: { scanId: true }
    })
  ]);

  let driftScore = 0;
  let snapshotConsistent: boolean | null = null;
  if (latestSnapshot?.scanId) {
    const check = await validateSnapshotAgainstReplay(latestSnapshot.scanId);
    driftScore = check.driftScore;
    snapshotConsistent = check.isConsistent;
  }

  const queueBacklog =
    consistency.queueDepths.queue_depth_high +
    consistency.queueDepths.queue_depth_normal +
    consistency.queueDepths.queue_depth_low;
  const rejectionRatePct = totalEvents > 0 ? (rejectedEvents / totalEvents) * 100 : 0;
  const replayDriftPenalty = Math.min(35, driftScore * 0.35);
  const queuePenalty = Math.min(25, queueBacklog / 40);
  const dlqPenalty = Math.min(20, consistency.queueDepths.dlq_count * 2);
  const rejectionPenalty = Math.min(12, rejectionRatePct * 2);
  const snapshotPenalty = snapshotConsistent === false ? 8 : 0;

  const score = clamp(100 - replayDriftPenalty - queuePenalty - dlqPenalty - rejectionPenalty - snapshotPenalty);
  detectOscillation("drift_score", driftScore);
  const stability = getStabilityScore();
  const stabilityPenalty = Math.round((100 - stability.stabilityScore) * 0.2);
  const budget = getBudgetSnapshot();
  const budgetPressurePenalty = Math.round(budget.totals.budgetPressureScore * 0.15);
  const finalScore = clamp(score - stabilityPenalty - budgetPressurePenalty);
  await reportHealthScore(finalScore);

  return {
    score: finalScore,
    status: statusFromScore(finalScore),
    components: {
      replayDrift: replayDriftPenalty,
      queueBacklog: queuePenalty,
      dlqSize: dlqPenalty,
      rejectionRatePct: rejectionPenalty,
      snapshotConsistencyPenalty: snapshotPenalty,
      stabilityPenalty,
      budgetPressurePenalty
    },
    details: {
      checkedScanId: latestSnapshot?.scanId ?? null,
      driftScore,
      queueDepthHigh: consistency.queueDepths.queue_depth_high,
      queueDepthNormal: consistency.queueDepths.queue_depth_normal,
      queueDepthLow: consistency.queueDepths.queue_depth_low,
      dlqCount: consistency.queueDepths.dlq_count,
      rejectedEvents,
      totalEvents,
      snapshotConsistent,
      stabilityScore: stability.stabilityScore,
      oscillationDetected: stability.oscillationDetected,
      signalDropRate: budget.totals.signalDropRate,
      compressedSignalCount: budget.totals.compressed,
      budgetPressureScore: budget.totals.budgetPressureScore
    }
  };
}
