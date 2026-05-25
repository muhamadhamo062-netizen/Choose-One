import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function has(name: string): boolean {
  const v = process.env[name];
  return Boolean(v && v.trim().length > 0);
}

export async function GET() {
  // Strategy pivot: local vault search is disabled.
  // Keep this endpoint for frontend compatibility, but always report inactive.
  return NextResponse.json({ ok: true, localDbActive: false });
}

