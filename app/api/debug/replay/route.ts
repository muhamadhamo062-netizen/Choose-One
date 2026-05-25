import { NextResponse } from "next/server";
import { getSessionUserIdFromCookies } from "@/lib/auth-cookies";
import { replayScan } from "@/lib/analytics/replay-engine";
import { isTemporaryDbUnavailable } from "@/lib/db-failsafe";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await getSessionUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const scanId = new URL(request.url).searchParams.get("scanId")?.trim() ?? "";
  if (!scanId) {
    return NextResponse.json({ ok: false, error: "scanId_required" }, { status: 400 });
  }
  try {
    const out = await replayScan(scanId);
    return NextResponse.json(out);
  } catch (error) {
    if (isTemporaryDbUnavailable(error)) {
      return NextResponse.json({ ok: false, error: "temporary_unavailable" }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: "replay_failed" }, { status: 500 });
  }
}
