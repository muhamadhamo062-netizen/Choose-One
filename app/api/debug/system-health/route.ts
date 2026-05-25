import { NextResponse } from "next/server";
import { getSessionUserIdFromCookies } from "@/lib/auth-cookies";
import { computeSystemHealthReport } from "@/lib/analytics/system-health-scoring";
import { triggerAutoHealing, getHealingState } from "@/lib/analytics/auto-healing-controller";
import { isTemporaryDbUnavailable } from "@/lib/db-failsafe";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getSessionUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const report = await computeSystemHealthReport();
    triggerAutoHealing(report);
    return NextResponse.json({
      health: report,
      healing: getHealingState()
    });
  } catch (error) {
    if (isTemporaryDbUnavailable(error)) {
      return NextResponse.json({ ok: false, error: "temporary_unavailable" }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: "system_health_failed" }, { status: 500 });
  }
}
