import { NextResponse } from "next/server";
import { getSessionUserIdFromCookies } from "@/lib/auth-cookies";
import { getStabilityScore } from "@/lib/analytics/system-stability-governor";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getSessionUserIdFromCookies();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const state = getStabilityScore();
  return NextResponse.json({
    stabilityScore: state.stabilityScore,
    oscillationDetected: state.oscillationDetected,
    blockedTransitions: state.blockedTransitions,
    lastStateChanges: state.lastStateChanges
  });
}
