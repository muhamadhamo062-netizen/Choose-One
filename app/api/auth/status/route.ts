import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

/** Lightweight auth probe for header/UI — JWT only, no database. */
export async function GET() {
  const s = await getSession();
  return NextResponse.json({
    ok: true,
    authed: s.kind === "authed"
  });
}
