import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBiWeeklyPrivacyAuditEmail } from "@/lib/email";
import {
  AUTOMATED_AUDIT_MONTHLY_LIMIT,
  getAutomatedAuditQuota,
  isActiveLifetimeSubscription
} from "@/lib/lifetime-scan-quota";
import { runSilentAutomatedDeepScanAudit } from "@/lib/silent-deep-scan-audit";
import { isTemporaryDbUnavailable } from "@/lib/db-failsafe";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return true;
  }
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const subs = await prisma.subscription.findMany({
      where: { plan: "lifetime", status: "active" },
      include: {
        user: {
          select: { id: true, email: true, fullName: true }
        }
      },
      orderBy: { startedAt: "desc" }
    });

    const seenUser = new Set<string>();
    let processed = 0;
    let emailed = 0;
    let skippedQuota = 0;
    let skippedDuplicate = 0;
    const errors: string[] = [];

    for (const sub of subs) {
      if (!sub.user?.email || seenUser.has(sub.user.id)) {
        skippedDuplicate += 1;
        continue;
      }
      seenUser.add(sub.user.id);

      if (!isActiveLifetimeSubscription(sub)) {
        continue;
      }

      try {
        const auditQuota = await getAutomatedAuditQuota(sub.user.id, sub.startedAt);
        if (auditQuota.used >= AUTOMATED_AUDIT_MONTHLY_LIMIT) {
          skippedQuota += 1;
          continue;
        }

        const latestScan = await prisma.scan.findFirst({
          where: { userId: sub.user.id },
          orderBy: { createdAt: "desc" },
          select: { state: true }
        });

        const summary = await runSilentAutomatedDeepScanAudit({
          userId: sub.user.id,
          email: sub.user.email,
          fullName: sub.user.fullName,
          stateCode: latestScan?.state ?? "NA",
          subscriptionStartedAt: sub.startedAt
        });

        const emailStatus = await sendBiWeeklyPrivacyAuditEmail(sub.user.email, {
          exposureScore: summary.exposureScore,
          sourcesDetected: summary.sourcesDetected,
          removalsInProgress: summary.removalsInProgress,
          verifiedRemovals: summary.verifiedRemovals,
          scanId: summary.publicScanId,
          riskLevel: summary.riskLevel
        });

        processed += 1;
        if (emailStatus === "sent") {
          emailed += 1;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "user_audit_failed";
        errors.push(`${sub.user.id}:${msg}`);
      }
    }

    return NextResponse.json({
      ok: true,
      mode: "biweekly_silent_audit",
      candidates: subs.length,
      processed,
      emailed,
      skippedQuota,
      skippedDuplicate,
      errors: errors.length ? errors.slice(0, 20) : undefined
    });
  } catch (error) {
    if (isTemporaryDbUnavailable(error)) {
      return NextResponse.json({ ok: false, error: "temporary_unavailable" }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: "monthly_audit_failed" }, { status: 500 });
  }
}
