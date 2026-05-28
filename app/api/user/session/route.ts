import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { computeServerDashboardState } from "@/lib/server/dashboard-state";
import { prisma } from "@/lib/prisma";
import type { DiscoveryResult } from "@/lib/types/discovery";
import { getSession, getUserFromSession } from "@/lib/auth-session";
import { jsonServiceDegraded, jsonUnauthorized } from "@/lib/api-response";
import { safeDbResult } from "@/lib/safe-db";
import { isActiveLifetimeSubscription, resolveDashboardScansRemaining } from "@/lib/lifetime-scan-quota";
import { attachOrphanScanToUser } from "@/lib/attach-orphan-scan";
import { PENDING_SCAN_COOKIE } from "@/lib/auth-cookies";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "development") {
    const cookie = cookies().get("pe_session");
    // eslint-disable-next-line no-console
    console.log("SESSION COOKIE:", cookie ? "EXISTS" : "MISSING");
  }

  const s = await getSession();
  if (s.kind === "server_misconfigured") {
    if (process.env.AUTH_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.log("SESSION VALID:", false);
    }
    return jsonServiceDegraded("server_misconfigured");
  }
  if (s.kind !== "authed") {
    if (process.env.NODE_ENV === "development" || process.env.AUTH_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.log("SESSION_STATE:", s.kind, s.kind === "invalid_token" ? "(jwt verify failed)" : "");
    }
    if (process.env.AUTH_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.log("SESSION VALID:", false);
    }
    return jsonUnauthorized();
  }

  const loaded = await getUserFromSession(s.userId);
  if (!loaded.user && s.userId.startsWith("emg_") && process.env.NODE_ENV === "development") {
    return NextResponse.json({
      ok: true,
      user: { id: s.userId, email: "emergency@local.dev", fullName: "Emergency User" },
      lifetimeEntitlement: null,
      scan: null,
      removalJobs: [],
      dashboardState: "NO_SCAN",
      scansRemaining: null,
      dataProvenance: {
        perBrokerRemovalStatus: "database",
        monitoringSchedule: "scheduled"
      },
      emergencyAuth: true
    });
  }
  if (loaded.user === null && loaded.dbError) {
    if (process.env.AUTH_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.log("SESSION VALID:", false);
    }
    return jsonServiceDegraded("database_unavailable");
  }
  if (!loaded.user) {
    if (process.env.AUTH_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.log("SESSION VALID:", false);
    }
    return jsonUnauthorized();
  }
  const user = loaded.user;

  const billingRes = await safeDbResult(() =>
    prisma.subscription.findFirst({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" }
    })
  );
  const scanRes = await safeDbResult(() =>
    prisma.scan.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" }
    })
  );
  const removalJobsRes = await safeDbResult(() =>
    prisma.removalJob.findMany({
      where: { userId: user.id },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 100
    })
  );

  if (!billingRes.ok || !scanRes.ok || !removalJobsRes.ok) {
    if (process.env.AUTH_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.log("SESSION VALID:", false);
    }
    return NextResponse.json(
      {
        ok: false,
        error: "session_data_unavailable",
        message: "We could not load your account details. Please try again.",
        user: { id: user.id, email: user.email, fullName: user.fullName },
        lifetimeEntitlement: null,
        scan: null,
        removalJobs: [],
        dashboardState: "NO_SCAN" as const,
        scansRemaining: null
      },
      { status: 200 }
    );
  }

  const billingRow = billingRes.value;
  let scan = scanRes.value;
  const removalJobs = removalJobsRes.value;

  if (!scan) {
    const pendingScanId = cookies().get(PENDING_SCAN_COOKIE)?.value?.trim() ?? null;
    const linkedId = await attachOrphanScanToUser({
      userId: user.id,
      email: user.email,
      publicScanId: pendingScanId
    });
    if (linkedId) {
      const again = await safeDbResult(() =>
        prisma.scan.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" }
        })
      );
      if (again.ok && again.value) {
        scan = again.value;
      }
    }
  }

  const dashboardState = computeServerDashboardState(scan, billingRow);
  const brokerSourceNames = extractBrokerNames(scan?.discoveryJson);
  const scansRemaining =
    isActiveLifetimeSubscription(billingRow) ? await resolveDashboardScansRemaining(user.id) : null;

  if (process.env.AUTH_DEBUG === "1") {
    // eslint-disable-next-line no-console
    console.log("SESSION VALID:", true);
  }
  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, fullName: user.fullName },
    lifetimeEntitlement: billingRow
      ? { plan: billingRow.plan, status: billingRow.status, startedAt: billingRow.startedAt.toISOString() }
      : null,
    scan: scan
      ? {
          scanId: scan.publicScanId,
          exposureScore: scan.exposureScore,
          brokersFound: scan.brokersFound,
          state: scan.state,
          riskLevel: scan.riskLevel,
          fullName: scan.fullName,
          email: scan.email,
          createdAt: scan.createdAt.toISOString(),
          brokerSourceNames
        }
      : null,
    removalJobs: removalJobs.map((job) => ({
      id: job.id,
      brokerName: job.brokerName,
      status: job.status as "pending" | "sent" | "verified" | "failed",
      requestChannel: job.requestChannel as "api" | "email",
      updatedAt: job.updatedAt.toISOString(),
      requestedAt: job.requestedAt ? job.requestedAt.toISOString() : null,
      verifiedAt: job.verifiedAt ? job.verifiedAt.toISOString() : null,
      lastError: job.lastError ?? null
    })),
    dashboardState,
    scansRemaining,
    dataProvenance: {
      perBrokerRemovalStatus: "database",
      monitoringSchedule: "scheduled"
    }
  });
}

function extractBrokerNames(discoveryJson: unknown): string[] {
  if (!discoveryJson || typeof discoveryJson !== "object") {
    return [];
  }
  const d = discoveryJson as DiscoveryResult;
  return Array.isArray(d.brokerSources) ? d.brokerSources : [];
}
