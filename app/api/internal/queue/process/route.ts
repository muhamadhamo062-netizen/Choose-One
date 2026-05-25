import { NextResponse } from "next/server";
import { isInternalRouteAuthorized } from "@/lib/internal/cron-auth";
import { processScanJobs } from "@/lib/queue/scan-queue";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron / worker bridge: process pending scan jobs in-process.
 * Protect with `CRON_SECRET` in production.
 */
export async function POST(request: Request) {
  if (!isInternalRouteAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Math.min(100, Math.max(1, Number(new URL(request.url).searchParams.get("limit") || 25) || 25));
  const processed = await processScanJobs(limit);
  return NextResponse.json({ ok: true, processed });
}

export async function GET(request: Request) {
  return POST(new Request(request.url, { method: "POST", headers: request.headers }));
}
