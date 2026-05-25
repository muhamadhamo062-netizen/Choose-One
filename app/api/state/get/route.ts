import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildGetResponse } from "@/lib/server-state-response";
import { COOKIE_STATE, parseStateCookie, parseScanCookie, SCAN_COOKIE } from "@/lib/server-state-cookie";

/**
 * Server-authoritative snapshot: cookies (HTTP) + future database.
 * Client may still send a body to `/api/state/sync` to align server cookies with local storage.
 */
export async function GET() {
  const c = cookies();
  const snap = parseStateCookie(c.get(COOKIE_STATE)?.value);
  const scan = parseScanCookie(c.get(SCAN_COOKIE)?.value);
  return NextResponse.json(buildGetResponse(snap, scan, snap ? "cookie" : "default"));
}
