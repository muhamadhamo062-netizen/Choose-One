import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { signSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth-cookies";
import { getAuthEnvIssue, runAuthDb } from "@/lib/auth-db";
import { findUserByAuthEmail } from "@/lib/find-user-by-auth-email";
import { logPrismaConnectionError } from "@/lib/logPrismaConnectionError";
import { jsonServiceDegraded } from "@/lib/api-response";
import { normalizeAuthEmail } from "@/lib/normalize-auth-email";
import { attachOrphanScanToUser } from "@/lib/attach-orphan-scan";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Set or replace password for an existing email (e.g. paid via Lemon Squeezy with random password, or forgot password).
 * Signs the user in on success.
 */
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

  const email = typeof body.email === "string" ? normalizeAuthEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  const lookup = await runAuthDb((db) => findUserByAuthEmail(db, email));
  if (!lookup.ok) {
    return jsonServiceDegraded("database_unavailable");
  }
  if (!lookup.value) {
    return NextResponse.json({ error: "email_not_found" }, { status: 404 });
  }

  const passwordHash = await hash(password, 12);
  const update = await runAuthDb((db) =>
    db.user.update({
      where: { id: lookup.value.id },
      data: { passwordHash }
    })
  );
  if (!update.ok) {
    logPrismaConnectionError("auth/set-password", new Error("update_failed"));
    return jsonServiceDegraded("database_unavailable");
  }

  let token: string;
  try {
    token = await signSessionToken(lookup.value.id);
  } catch (e) {
    return jsonServiceDegraded("session_not_configured");
  }

  void attachOrphanScanToUser({ userId: lookup.value.id, email: lookup.value.email });

  const res = NextResponse.json({
    ok: true,
    user: { id: lookup.value.id, email: lookup.value.email, fullName: lookup.value.fullName }
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
