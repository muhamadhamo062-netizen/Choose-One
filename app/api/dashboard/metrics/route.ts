import { NextResponse } from "next/server";
import { getSessionUserIdFromCookies } from "@/lib/auth-cookies";
import { computeDashboardMetrics } from "@/lib/analytics/metrics-engine";
import { isTemporaryDbUnavailable } from "@/lib/db-failsafe";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const debugMode = new URL(request.url).searchParams.get("debug") === "true";
  const debugReplay = new URL(request.url).searchParams.get("debugReplay") === "true";
  try {
    const { metrics, debug } = await computeDashboardMetrics({ debug: debugMode, debugReplay });
    if (debugMode) {
      return NextResponse.json({
        ...metrics,
        debug
      });
    }
    return NextResponse.json(metrics);
  } catch (error) {
    const prismaCode = typeof (error as { code?: string })?.code === "string" ? (error as { code: string }).code : "";
    if (prismaCode === "P2021" || prismaCode === "P2022") {
      return NextResponse.json({
        scans: 0,
        sourcesFound: 0,
        removalsRequested: 0,
        verifiedRemovals: 0,
        pending: 0,
        successRate: 0,
        lastUpdated: new Date().toISOString()
      });
    }
    if (isTemporaryDbUnavailable(error)) {
      return NextResponse.json({ ok: false, error: "temporary_unavailable" }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: "metrics_failed" }, { status: 500 });
  }
}
