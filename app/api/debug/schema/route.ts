import { NextResponse } from "next/server";
import { getSessionUserIdFromCookies } from "@/lib/auth-cookies";
import { prisma } from "@/lib/prisma";
import { getRegionSchemaVersionMap } from "@/lib/analytics/region/region-context";
import { getCompatibilityMatrix } from "@/lib/analytics/schema/event-schema-registry";
import { getSchemaDriftReport } from "@/lib/analytics/schema/schema-drift-detector";
import { getUpcastStats } from "@/lib/analytics/schema/event-upcaster";
import { safeDbResult } from "@/lib/safe-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getSessionUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const legacyRes = await safeDbResult(() =>
    prisma.analyticsEvent.findMany({
      select: { metadata: true },
      take: 2000,
      orderBy: { createdAt: "desc" }
    })
  );
  const legacyEventCounts = legacyRes.ok
    ? legacyRes.value.filter((r) => {
        const m = (r.metadata ?? {}) as Record<string, unknown>;
        return m.legacy_unresolved === true || Number(m.eventVersion ?? 1) < 1;
      }).length
    : 0;

  return NextResponse.json({
    activeSchemaVersionsPerRegion: getRegionSchemaVersionMap(),
    compatibilityMatrix: getCompatibilityMatrix(),
    driftReport: getSchemaDriftReport(),
    upcastStats: getUpcastStats(),
    legacyEventCounts
  });
}
