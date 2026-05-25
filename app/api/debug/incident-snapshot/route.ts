import { NextResponse } from "next/server";
import { getSessionUserIdFromCookies } from "@/lib/auth-cookies";
import { getSystemControlState } from "@/lib/analytics/system-control-plane";
import { computeSystemHealthReport } from "@/lib/analytics/system-health-scoring";
import { getProjectionQueueDepths } from "@/lib/analytics/event-queue";
import { getCriticalSignals } from "@/lib/analytics/observability-bus";
import { allCircuitStates } from "@/lib/analytics/circuit-breaker";
import { getHealingState } from "@/lib/analytics/auto-healing-controller";
import { isTemporaryDbUnavailable } from "@/lib/db-failsafe";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getSessionUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const [control, queueHealth, health] = await Promise.all([
      getSystemControlState(),
      getProjectionQueueDepths(),
      computeSystemHealthReport()
    ]);

    return NextResponse.json({
      systemMode: control.systemMode,
      queueHealth,
      dlqSize: queueHealth.dlq_count,
      replayDriftSummary: {
        driftScore: health.details.driftScore,
        checkedScanId: health.details.checkedScanId
      },
      last20CriticalEvents: getCriticalSignals(20),
      circuitBreakerState: allCircuitStates(),
      autoHealingStatus: getHealingState(),
      snapshotConsistencyScore: health.details.snapshotConsistent === null ? null : health.details.snapshotConsistent ? 100 : 0
    });
  } catch (error) {
    if (isTemporaryDbUnavailable(error)) {
      return NextResponse.json({ ok: false, error: "temporary_unavailable" }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: "incident_snapshot_failed" }, { status: 500 });
  }
}
