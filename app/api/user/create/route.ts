import { hash } from "bcryptjs";
import { createHash } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signSessionToken, SESSION_COOKIE, PENDING_SCAN_COOKIE, sessionCookieOptions } from "@/lib/auth-cookies";
import { emitServerEvent } from "@/lib/events/event-emitter";
import { prisma } from "@/lib/prisma";
import { getQueueJobByPublicId, linkPendingJobToUser } from "@/lib/queue/scan-queue";
import { logPrismaConnectionError } from "@/lib/logPrismaConnectionError";
import { isSupabaseEnvUnfinishedTemplate } from "@/lib/validateSupabasePrismaEnv";
import { hashSensitiveValue, maskEmail } from "@/lib/privacy-safe";
import { safeDbResult } from "@/lib/safe-db";
import { jsonServiceDegraded } from "@/lib/api-response";
import { createDirectPrismaClient } from "@/lib/prisma-direct";
import { sendAuthOtpEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  password?: string;
  scanId?: string;
  fullName?: string;
  activateLifetime?: boolean;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : email.split("@")[0] || "Member";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }
  const du = process.env.DATABASE_URL?.trim() ?? "";
  const di = process.env.DIRECT_URL?.trim() ?? "";
  if (!du || !di) {
    return jsonServiceDegraded("database_not_configured");
  }
  if (isSupabaseEnvUnfinishedTemplate(du, di)) {
    return jsonServiceDegraded("supabase_paste_required");
  }

  let existingUser: { id: string } | null = null;
  const existingRes = await safeDbResult(() =>
    prisma.user.findUnique({ where: { email }, select: { id: true } })
  );
  if (existingRes.ok) {
    existingUser = existingRes.value;
  } else {
    const directPrisma = createDirectPrismaClient();
    if (!directPrisma) {
      logPrismaConnectionError("user/create:db_lookup", new Error("db_lookup_failed_no_direct_url"));
      if (process.env.NODE_ENV === "development") {
        return emergencyAuthResponse();
      }
      return jsonServiceDegraded("temporary_unavailable");
    }
    const directLookup = await safeDbResult(() =>
      directPrisma.user.findUnique({ where: { email }, select: { id: true } })
    );
    await directPrisma.$disconnect().catch(() => undefined);
    if (!directLookup.ok) {
      logPrismaConnectionError("user/create:db_lookup", new Error("db_lookup_failed_all_paths"));
      if (process.env.NODE_ENV === "development") {
        return emergencyAuthResponse();
      }
      return jsonServiceDegraded("temporary_unavailable");
    }
    existingUser = directLookup.value;
  }
  if (existingUser) {
    return NextResponse.json({ error: "email_in_use" }, { status: 409 });
  }

  const passwordHash = await hash(password, 12);
  const scanIdFromBody = typeof body.scanId === "string" ? body.scanId.trim() : "";
  const scanIdFromCookie = cookies().get(PENDING_SCAN_COOKIE)?.value?.trim() ?? "";
  const linkScanId = scanIdFromBody || scanIdFromCookie;
  async function emergencyAuthResponse() {
    const emergencyUserId = `emg_${createHash("sha256").update(email).digest("hex").slice(0, 24)}`;
    const token = await signSessionToken(emergencyUserId);
    const res = NextResponse.json({
      ok: true,
      user: { id: emergencyUserId, email, fullName },
      linkedScan: false,
      scanId: "",
      emergencyAuth: true
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    res.cookies.set(PENDING_SCAN_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    return res;
  }
  const wantLifetime =
    body.activateLifetime === true &&
    (process.env.NODE_ENV === "development" || process.env.PE_ALLOW_CLIENT_LIFETIME === "true");

  const txRes = await safeDbResult(() =>
    prisma.$transaction(async (tx) => {
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

  let user: { id: string; email: string; fullName: string | null };
  let linkedFromTx = false;
  if (!txRes.ok) {
    // Fallback path: if primary client write fails, retry via direct client.
    const directPrisma = createDirectPrismaClient();
    const createUser = () =>
      (directPrisma ?? prisma).user.create({
        data: { email, passwordHash, fullName },
        select: { id: true, email: true, fullName: true }
      });
    const userOnlyRes = await safeDbResult(createUser);
    if (directPrisma) {
      await directPrisma.$disconnect().catch(() => undefined);
    }
    if (!userOnlyRes.ok) {
      logPrismaConnectionError("user/create:transaction", new Error("transaction_failed"));
      if (process.env.NODE_ENV === "development") {
        return emergencyAuthResponse();
      }
      return NextResponse.json(
        { ok: false, error: "create_failed", message: "We could not create your account. Please try again." },
        { status: 200 }
      );
    }
    user = userOnlyRes.value;
    const directPrismaForSubscription = createDirectPrismaClient();
    const subscriptionRes = await safeDbResult(() =>
      (directPrismaForSubscription ?? prisma).subscription.create({
        data: {
          userId: user.id,
          plan: wantLifetime ? "lifetime" : "free",
          status: "active"
        }
      })
    );
    if (directPrismaForSubscription) {
      await directPrismaForSubscription.$disconnect().catch(() => undefined);
    }
    if (!subscriptionRes.ok) {
      logPrismaConnectionError("user/create:fallback_subscription", new Error("subscription_create_failed"));
    }
    if (linkScanId) {
      const directPrismaForScan = createDirectPrismaClient();
      const scanLinkRes = await safeDbResult(async () => {
        const scan = await (directPrismaForScan ?? prisma).scan.findFirst({
          where: { publicScanId: linkScanId, userId: null }
        });
        if (!scan) return false;
        await (directPrismaForScan ?? prisma).scan.update({
          where: { id: scan.id },
          data: { userId: user.id, email: user.email }
        });
        return true;
      });
      if (directPrismaForScan) {
        await directPrismaForScan.$disconnect().catch(() => undefined);
      }
      if (scanLinkRes.ok) {
        linkedFromTx = scanLinkRes.value;
      }
    }
  } else {
    user = txRes.value.u;
    linkedFromTx = txRes.value.linkedScan;
  }

  let linkedScan = linkedFromTx;

  if (linkScanId) {
    const linkRes = await safeDbResult(() => linkPendingJobToUser(linkScanId, user.id));
    if (linkRes.ok && !linkedScan) {
      const jobRes = await safeDbResult(() => getQueueJobByPublicId(linkScanId));
      if (jobRes.ok && jobRes.value && (jobRes.value.status === "pending" || jobRes.value.status === "processing")) {
        linkedScan = true;
      }
    }
  }

  const token = await signSessionToken(user.id);
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
