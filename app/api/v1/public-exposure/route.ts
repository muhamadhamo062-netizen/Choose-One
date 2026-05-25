import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/scan-rate-limit";
import { simulatePublicExposure } from "@/lib/public-exposure-sim";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rate = await enforceRateLimit(request, {
    keyPrefix: "rate:public-exposure",
    limit: 30,
    windowSeconds: 60 * 60
  });
  if (!rate.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { fullName?: string; stateCode?: string } | null;
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const stateCode = typeof body?.stateCode === "string" ? body.stateCode.trim().toUpperCase() : "";
  if (!fullName || fullName.length < 3 || !stateCode) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const result = simulatePublicExposure({ fullName, stateCode });
  return NextResponse.json(result);
}

