import { NextResponse } from "next/server";
import { getSessionUserIdFromCookies } from "@/lib/auth-cookies";
import { getBudgetSnapshot } from "@/lib/analytics/observability-budget";
import { getObservabilityState } from "@/lib/analytics/observability-bus";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getSessionUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const budget = getBudgetSnapshot();
  const obs = getObservabilityState();
  return NextResponse.json({
    budgetUsage: {
      usage: budget.usage,
      allowed: budget.allowed,
      remainingBudget: budget.remainingBudget
    },
    compressedSignals: obs.compressedSignals,
    dropRate: budget.totals.signalDropRate,
    pressureScore: budget.totals.budgetPressureScore
  });
}
