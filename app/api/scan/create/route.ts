import { NextResponse } from "next/server";
import { getSessionUserIdFromCookies, PENDING_SCAN_COOKIE, pendingScanCookieOptions } from "@/lib/auth-cookies";
import { dispatchScanCreate, validateScanCreateBody } from "@/lib/scan/scan-create-service";
import { isTemporaryDbUnavailable } from "@/lib/db-failsafe";
import { enforceScanRateLimit } from "@/lib/scan-rate-limit";

export const dynamic = "force-dynamic";

/**
 * Enqueues a scan; worker persists Scan + ScanSession. Client polls `GET /api/scan/status`.
 * Sets `pe_pending_scan_id` (httpOnly) to attach this scan at signup.
 */
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
  const v = validateScanCreateBody(body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: v.status });
  }
  const userId = await getSessionUserIdFromCookies();

  try {
    const result = await dispatchScanCreate({
      fullName: v.fullName,
      email: v.email,
      stateCode: v.stateCode,
      userId: userId ?? null
    });
    const res = NextResponse.json({
      message: "Scan initiated",
      scanId: result.scanId,
      jobId: result.jobId,
      status: "started",
      jobStatus: result.status
    });
    res.cookies.set(PENDING_SCAN_COOKIE, result.scanId, pendingScanCookieOptions());
    return res;
  } catch (e) {
    console.error("[scan/create] enqueue_failed", e);
    if (isTemporaryDbUnavailable(e)) {
      return NextResponse.json({ ok: false, error: "temporary_unavailable" }, { status: 200 });
    }
    return NextResponse.json({ error: "scan_enqueue_failed" }, { status: 200 });
  }
}
