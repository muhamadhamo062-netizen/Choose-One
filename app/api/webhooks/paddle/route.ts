import { NextResponse } from "next/server";

/** Paddle billing is retired — use Lemon Squeezy webhooks. */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "paddle_retired",
      message: "Billing migrated to Lemon Squeezy. Point webhooks to /api/webhooks/lemon-squeezy"
    },
    { status: 410 }
  );
}
