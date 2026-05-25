import { NextRequest, NextResponse } from "next/server";
import { restoreRecoveryPoint } from "@/lib/analytics/recovery-points";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      pointId?: string;
      force?: boolean;
      dryRun?: boolean;
    };
    if (!body.pointId) {
      return NextResponse.json({ ok: false, error: "point_id_required" }, { status: 400 });
    }
    const result = await restoreRecoveryPoint(body.pointId, {
      force: Boolean(body.force),
      dryRun: body.dryRun !== false
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch {
    return NextResponse.json({ ok: false, error: "temporary_unavailable" }, { status: 200 });
  }
}
