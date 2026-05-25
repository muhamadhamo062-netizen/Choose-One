import { NextResponse } from "next/server";
import { isInternalRouteAuthorized } from "@/lib/internal/cron-auth";
import { executePendingRemovalJobs, verifyDueRemovalJobs } from "@/lib/removal-engine";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isInternalRouteAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const mode = (url.searchParams.get("mode") || "execute").toLowerCase();
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 25) || 25));

  if (mode === "verify") {
    const verification = await verifyDueRemovalJobs(limit);
    return NextResponse.json({ ok: true, mode, ...verification });
  }

  const execution = await executePendingRemovalJobs(limit);
  return NextResponse.json({ ok: true, mode: "execute", ...execution });
}

export async function GET(request: Request) {
  return POST(new Request(request.url, { method: "POST", headers: request.headers }));
}
