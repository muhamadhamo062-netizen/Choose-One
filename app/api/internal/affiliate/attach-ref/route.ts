import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { ok: false, error: "affiliate_managed_by_paddle", message: "Referral attachment is managed via Paddle Affiliates." },
    { status: 410 }
  );
}

