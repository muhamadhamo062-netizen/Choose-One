import { NextResponse } from "next/server";
import { getScanStatusPayload } from "@/lib/scan/scan-status-service";
export const dynamic = "force-dynamic";

/**
 * Returns job status or completed discovery + risk once the worker has written `Scan` rows.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scanId = (searchParams.get("scanId") || searchParams.get("id") || "").trim();
  if (!scanId) {
    return NextResponse.json({ error: "scanId_required" }, { status: 400 });
  }
  try {
    const out = await getScanStatusPayload(scanId);
    if (!out.ok) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(out);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("DB ERROR:", error);
    return NextResponse.json(
      { ok: false, error: "status_unavailable", message: "Please try again." },
      { status: 200 }
    );
  }
}
