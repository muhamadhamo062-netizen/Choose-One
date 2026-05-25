import { NextResponse } from "next/server";
import { getSessionUserIdFromCookies } from "@/lib/auth-cookies";
import { getCurrentCostPressure, getCostBreakdown } from "@/lib/analytics/cost/cost-meter";
import { getBudgetStatus } from "@/lib/analytics/cost/cost-budgets";
import { getThrottledOperations } from "@/lib/analytics/cost/cost-governor";

export const dynamic = "force-dynamic";

function perOpCost() {
  return {
    dbRead: Number(process.env.COST_DB_READ ?? "0.00001"),
    dbWrite: Number(process.env.COST_DB_WRITE ?? "0.00005"),
    queueOp: Number(process.env.COST_QUEUE_OP ?? "0.00001"),
    projectionJob: Number(process.env.COST_PROJECTION_JOB ?? "0.00002"),
    replay: Number(process.env.COST_REPLAY_EXEC ?? "0.0002"),
    replication: Number(process.env.COST_REPLICATION_EVENT ?? "0.00003")
  };
}

export async function GET() {
  const userId = await getSessionUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const pressure = getCurrentCostPressure();
  const breakdown = getCostBreakdown();
  const budgets = getBudgetStatus();
  const rates = perOpCost();
  const minuteCost =
    breakdown.dbReads * rates.dbRead +
    breakdown.dbWrites * rates.dbWrite +
    breakdown.queueOps * rates.queueOp +
    breakdown.projectionJobs * rates.projectionJob +
    breakdown.replayExecutions * rates.replay +
    breakdown.replicationEvents * rates.replication;
  const projectedMonthlyCostEstimate = Number((minuteCost * 60 * 24 * 30).toFixed(2));

  return NextResponse.json({
    currentCostPressureScore: pressure,
    subsystemBreakdown: breakdown,
    budgets,
    throttledOperations: getThrottledOperations(),
    projectedMonthlyCostEstimate
  });
}
