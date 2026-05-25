import { NextResponse } from "next/server";
import { discoverIdentity } from "@/lib/data-discovery-engine";
import { analyzeRisk } from "@/lib/risk-analysis";
import { getStateLabel } from "@/lib/us-states";
import { enforceScanRateLimit } from "@/lib/scan-rate-limit";

/**
 * Server-side scan: runs discovery (connector-backed) + risk analysis. No PII is fabricated;
 * broker fields are empty unless a connector returns them.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rate = await enforceScanRateLimit(request);
  if (!rate.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as { fullName?: string; email?: string; stateCode?: string };
  const stateCode = typeof b.stateCode === "string" ? b.stateCode.trim() : "";
  if (!stateCode) {
    return NextResponse.json({ error: "state_required" }, { status: 400 });
  }
  const fullName = typeof b.fullName === "string" ? b.fullName.trim() : "";
  const email = typeof b.email === "string" && b.email.trim() ? b.email.trim() : undefined;
  const stateLabel = getStateLabel(stateCode);

  const discovery = await discoverIdentity({
    fullName,
    email,
    stateCode,
    stateLabel
  });
  const risk = analyzeRisk(discovery);

  return NextResponse.json({
    discovery,
    risk,
    stateCode,
    stateLabel
  });
}
