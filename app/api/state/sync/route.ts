import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildSnapshotFromSync } from "@/lib/build-server-snapshot";
import { buildGetResponse } from "@/lib/server-state-response";
import {
  COOKIE_MAX_AGE_SEC,
  COOKIE_STATE,
  maybeSerializeScanForCookie,
  parseStateCookie,
  SCAN_COOKIE,
  serializeStateCookie
} from "@/lib/server-state-cookie";
import type { ClientSyncBody } from "@/lib/server-state-types";

export async function POST(request: Request) {
  const body = (await request.json()) as ClientSyncBody;
  const c = cookies();
  const existing = parseStateCookie(c.get(COOKIE_STATE)?.value);
  const snapshot = buildSnapshotFromSync(existing, body);
  const scanEcho = maybeSerializeScanForCookie(body.scan);

  const res = NextResponse.json(buildGetResponse(snapshot, body.scan ?? null, "cookie"));

  res.cookies.set(COOKIE_STATE, serializeStateCookie(snapshot), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SEC
  });

  if (scanEcho) {
    res.cookies.set(SCAN_COOKIE, scanEcho, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SEC
    });
  } else {
    res.cookies.delete(SCAN_COOKIE);
  }

  return res;
}
