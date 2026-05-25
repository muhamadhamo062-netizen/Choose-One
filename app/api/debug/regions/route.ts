import { NextResponse } from "next/server";
import { getSessionUserIdFromCookies } from "@/lib/auth-cookies";
import { getActiveRegion, getFailoverRegion } from "@/lib/analytics/region/region-context";
import { getRegionHealth, refreshLocalRegionHealth } from "@/lib/analytics/region/region-health-monitor";
import { getQueueDistribution } from "@/lib/analytics/event-queue";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getSessionUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  await refreshLocalRegionHealth().catch(() => {
    // best effort
  });
  const activeRegion = getActiveRegion();
  const regionHealth = getRegionHealth();
  return NextResponse.json({
    activeRegion,
    failoverRegion: getFailoverRegion(activeRegion),
    regionHealth,
    replicationLag: regionHealth[activeRegion]?.replicationLagMs ?? 0,
    failoverStatus: (regionHealth[activeRegion]?.healthy ?? true) ? "standby" : "active",
    queueDistribution: getQueueDistribution()
  });
}
