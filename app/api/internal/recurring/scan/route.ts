import { NextResponse } from "next/server";
import { isInternalRouteAuthorized } from "@/lib/internal/cron-auth";
import { enqueueDueRecurringScansForActiveSubscribers } from "@/lib/queue/recurring-scans";

export const dynamic = "force-dynamic";

/**
 * Enqueues 7-day recurring re-scans for active paid users. A worker (or
 * `POST /api/internal/queue/process`) must then process jobs.
 */
export async function POST(request: Request) {
  if (!isInternalRouteAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { enqueued } = await enqueueDueRecurringScansForActiveSubscribers();
  return NextResponse.json({ ok: true, enqueued });
}

export async function GET(request: Request) {
  return POST(new Request(request.url, { method: "POST", headers: request.headers }));
}
