import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { ok: false, error: "affiliate_managed_by_paddle", message: "Affiliate session is managed via Lemon Squeezy Affiliates." },
    { status: 410 }
  );
}
