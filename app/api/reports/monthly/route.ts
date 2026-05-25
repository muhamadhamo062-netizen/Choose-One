import { NextResponse } from "next/server";
import { getSessionUserIdFromCookies } from "@/lib/auth-cookies";
import { prisma } from "@/lib/prisma";
import { safeDbResult } from "@/lib/safe-db";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  const userId = await getSessionUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const since = new Date(Date.now() - 30 * DAY_MS);
  const eventsRes = await safeDbResult(() =>
    prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "asc" }
    })
  );
  if (!eventsRes.ok) {
    return NextResponse.json(
      { ok: false, error: "report_unavailable", message: "Please try again later." },
      { status: 200 }
    );
  }
  const events = eventsRes.value;

  const grouped = new Map<string, { scanId: string; userId: string | null; events: typeof events }>();
  for (const ev of events) {
    const key = `${ev.userId ?? "anon"}:${ev.scanId ?? "none"}`;
    const current = grouped.get(key);
    if (current) {
      current.events.push(ev);
    } else {
      grouped.set(key, {
        scanId: ev.scanId ?? "",
        userId: ev.userId ?? null,
        events: [ev]
      });
    }
  }

  const verificationOutcomes = {
    verifiedDeleted: events.filter((e) => e.type === "verified_deleted").length,
    partialDeleted: events.filter((e) => e.type === "partial_deleted").length,
    notConfirmed: events.filter((e) => e.type === "not_confirmed").length
  };

  return NextResponse.json({
    summary: {
      from: since.toISOString(),
      to: new Date().toISOString(),
      totalEvents: events.length,
      uniqueScanIds: new Set(events.map((e) => e.scanId).filter(Boolean)).size,
      uniqueUserIds: new Set(events.map((e) => e.userId).filter(Boolean)).size
    },
    timeline: events.map((e) => ({
      id: e.id,
      scanId: e.scanId,
      userId: e.userId,
      type: e.type,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString()
    })),
    groupedByScanAndUser: Array.from(grouped.values()).map((g) => ({
      scanId: g.scanId,
      userId: g.userId,
      eventCount: g.events.length,
      events: g.events.map((e) => ({
        id: e.id,
        type: e.type,
        metadata: e.metadata,
        createdAt: e.createdAt.toISOString()
      }))
    })),
    verificationOutcomes
  });
}
