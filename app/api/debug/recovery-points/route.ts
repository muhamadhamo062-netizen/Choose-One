import { NextResponse } from "next/server";
import { listRecoveryPoints } from "@/lib/analytics/recovery-points";

export async function GET() {
  try {
    const points = await listRecoveryPoints();
    return NextResponse.json({ ok: true, points });
  } catch {
    return NextResponse.json({ ok: false, error: "temporary_unavailable" }, { status: 200 });
  }
}
