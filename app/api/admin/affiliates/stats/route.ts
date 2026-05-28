import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "affiliate_managed_by_paddle", message: "Admin affiliate analytics are managed via Lemon Squeezy Affiliates." },
    { status: 410 }
  );
}
