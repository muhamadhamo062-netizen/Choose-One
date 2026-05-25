import { NextResponse } from "next/server";
import { getSessionUserIdFromCookies } from "@/lib/auth-cookies";
import { isTemporaryDbUnavailable } from "@/lib/db-failsafe";
import { validateSnapshotAgainstReplay } from "@/lib/analytics/snapshot-consistency-validator";

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
    const out = await validateSnapshotAgainstReplay(scanId);
    return NextResponse.json({
      scanId,
      replay: out.replay,
      snapshot: out.latestSnapshot,
      diffSummary: out.mismatches,
      driftScore: out.driftScore,
      anomalies: out.replay.anomalies
    });
  } catch (error) {
    if (isTemporaryDbUnavailable(error)) {
      return NextResponse.json({ ok: false, error: "temporary_unavailable" }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: "replay_diff_failed" }, { status: 500 });
  }
}
