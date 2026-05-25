import { NextRequest, NextResponse } from "next/server";
import { getSessionUserIdFromCookies } from "@/lib/auth-cookies";
import { acquireFence, getFenceState, releaseFence } from "@/lib/analytics/global-write-fence";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getSessionUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const fence = await getFenceState();
  return NextResponse.json({ ok: true, fence });
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    action?: "acquire" | "release";
    reason?: string;
    ttlMs?: number;
    state?: "ACTIVE" | "EXCLUSIVE";
    fenceId?: string;
  };
  if (body.action === "release") {
    if (!body.fenceId) {
      return NextResponse.json({ ok: false, error: "fence_id_required" }, { status: 400 });
    }
    const result = await releaseFence(body.fenceId);
    return NextResponse.json({ ok: true, result, fence: await getFenceState() });
  }

  const reason = body.reason?.trim() || "manual_debug";
  const ttlMs = Number.isFinite(body.ttlMs) ? Number(body.ttlMs) : undefined;
  const result = await acquireFence(reason, ttlMs, { state: body.state ?? "ACTIVE" });
  return NextResponse.json({ ok: true, result, fence: await getFenceState() });
}
