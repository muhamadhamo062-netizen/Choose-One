import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { signSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth-cookies";
import { getAuthEnvIssue, runAuthDb } from "@/lib/auth-db";
import { logPrismaConnectionError } from "@/lib/logPrismaConnectionError";
import { jsonServiceDegraded } from "@/lib/api-response";
import { sendAuthOtpEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const envIssue = getAuthEnvIssue();
  if (envIssue) {
    return jsonServiceDegraded(envIssue);
  }

  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 400 });
  }

  const userRes = await runAuthDb((db) =>
    db.user.findUnique({
      where: { email },
      select: { id: true, email: true, fullName: true, passwordHash: true }
    })
  );

  if (!userRes.ok) {
    logPrismaConnectionError("auth/login", new Error("user_find_failed"));
    return NextResponse.json(
      {
        ok: false,
        error: "service_unavailable",
        reason: "database_unavailable",
        hint: "Open /api/health/auth on this domain after setting Vercel env vars",
        message: "Sign-in is temporarily unavailable. Please try again."
      },
      { status: 200 }
    );
  }

  const user = userRes.value;
  if (!user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  if (!user.passwordHash) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const passwordOk = await compare(password, user.passwordHash);
  if (!passwordOk) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  let token: string;
  try {
    token = await signSessionToken(user.id);
  } catch (e) {
    logPrismaConnectionError("auth/login:session", e);
    return jsonServiceDegraded("session_not_configured");
  }

  void sendAuthOtpEmail(user.email, "login");
  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, fullName: user.fullName }
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
