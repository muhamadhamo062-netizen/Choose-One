import { NextResponse } from "next/server";
import { cleanupSensitiveData } from "@/lib/cleanup-sensitive-data";
import { isTemporaryDbUnavailable } from "@/lib/db-failsafe";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return true;
  }
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    await cleanupSensitiveData();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isTemporaryDbUnavailable(error)) {
      return NextResponse.json({ ok: false, error: "temporary_unavailable" }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: "cleanup_failed" }, { status: 500 });
  }
}
