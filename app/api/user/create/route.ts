import { hash } from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signSessionToken, SESSION_COOKIE, PENDING_SCAN_COOKIE, sessionCookieOptions } from "@/lib/auth-cookies";
import { getAuthEnvIssue, runAuthDb } from "@/lib/auth-db";
import { emitServerEvent } from "@/lib/events/event-emitter";
import { getQueueJobByPublicId, linkPendingJobToUser } from "@/lib/queue/scan-queue";
import { logPrismaConnectionError } from "@/lib/logPrismaConnectionError";
import { hashSensitiveValue, maskEmail } from "@/lib/privacy-safe";
import { safeDbResult } from "@/lib/safe-db";
import { jsonServiceDegraded } from "@/lib/api-response";
import { sendAuthOtpEmail } from "@/lib/email";
import { attachOrphanScanToUser } from "@/lib/attach-orphan-scan";
import { normalizeAuthEmail } from "@/lib/normalize-auth-email";
import { findUserByAuthEmail } from "@/lib/find-user-by-auth-email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Body = {
  email?: string;
  password?: string;
  scanId?: string;
  fullName?: string;
  activateLifetime?: boolean;
};

export async function POST(request: Request) {
  const envIssue = getAuthEnvIssue();
  if (envIssue) {
    return jsonServiceDegraded(envIssue);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? normalizeAuthEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : email.split("@")[0] || "Member";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  const existingRes = await runAuthDb((db) => findUserByAuthEmail(db, email));
  if (!existingRes.ok) {
    logPrismaConnectionError("user/create:lookup", new Error("db_lookup_failed"));
    return jsonServiceDegraded("database_unavailable");
  }
  if (existingRes.value) {
    const existing = existingRes.value;
    if (!existing.passwordHash) {
      const passwordHash = await hash(password, 12);
      const setPw = await runAuthDb((db) =>
        db.user.update({
          where: { id: existing.id },
          data: { passwordHash, fullName: fullName || existing.fullName }
        })
      );
      if (!setPw.ok) {
        return jsonServiceDegraded("database_unavailable");
      }
      let token: string;
      try {
        token = await signSessionToken(existing.id);
      } catch (e) {
        logPrismaConnectionError("user/create:set_password", e);
        return jsonServiceDegraded("session_not_configured");
      }
      const res = NextResponse.json({
        ok: true,
        user: { id: existing.id, email: existing.email, fullName: fullName || existing.fullName },
        linkedScan: false,
        scanId: "",
        passwordSet: true
      });
      res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
      return res;
    }
    return NextResponse.json({ error: "email_in_use" }, { status: 409 });
  }

  const passwordHash = await hash(password, 12);
  const scanIdFromBody = typeof body.scanId === "string" ? body.scanId.trim() : "";
  const scanIdFromCookie = cookies().get(PENDING_SCAN_COOKIE)?.value?.trim() ?? "";
  const linkScanId = scanIdFromBody || scanIdFromCookie;
  const wantLifetime =
    body.activateLifetime === true &&
    (process.env.NODE_ENV === "development" || process.env.PE_ALLOW_CLIENT_LIFETIME === "true");

  const txRes = await runAuthDb((db) =>
    db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email, passwordHash, fullName }
      });
      await tx.subscription.create({
        data: {
          userId: u.id,
          plan: wantLifetime ? "lifetime" : "free",
          status: "active"
        }
      });
      let linked = false;
      if (linkScanId) {
        const scan = await tx.scan.findFirst({
          where: { publicScanId: linkScanId, userId: null }
        });
        if (scan) {
          await tx.scan.update({
            where: { id: scan.id },
            data: { userId: u.id, email: u.email }
          });
          linked = true;
        }
      }
      return { u, linkedScan: linked };
    })
  );

  if (!txRes.ok) {
    logPrismaConnectionError("user/create:transaction", new Error("transaction_failed"));
    return NextResponse.json(
      { ok: false, error: "create_failed", message: "We could not create your account. Please try again." },
      { status: 200 }
    );
  }

  const { u: user, linkedScan: linkedFromTx } = txRes.value;
  let linkedScan = linkedFromTx;

  if (!linkedScan) {
    const attached = await attachOrphanScanToUser({
      userId: user.id,
      email: user.email,
      publicScanId: linkScanId || null
    });
    if (attached) {
      linkedScan = true;
    }
  }

  if (linkScanId) {
    const linkRes = await safeDbResult(() => linkPendingJobToUser(linkScanId, user.id));
    if (linkRes.ok && !linkedScan) {
      const jobRes = await safeDbResult(() => getQueueJobByPublicId(linkScanId));
      if (jobRes.ok && jobRes.value && (jobRes.value.status === "pending" || jobRes.value.status === "processing")) {
        linkedScan = true;
      }
    }
  }

  let token: string;
  try {
    token = await signSessionToken(user.id);
  } catch (e) {
    logPrismaConnectionError("user/create:session", e);
    return jsonServiceDegraded("session_not_configured");
  }

  void sendAuthOtpEmail(user.email, "signup");
  void emitServerEvent({
    event: "signup_completed",
    userId: user.id,
    payload: {
      emailHash: hashSensitiveValue(user.email),
      emailMasked: maskEmail(user.email),
      linkedScan,
      scanId: linkedScan && linkScanId ? linkScanId : ""
    }
  });

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, fullName: user.fullName },
    linkedScan,
    scanId: linkedScan && linkScanId ? linkScanId : ""
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  res.cookies.set(PENDING_SCAN_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
