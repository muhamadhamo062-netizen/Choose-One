import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { recordDeepScanUsage } from "@/lib/lifetime-scan-quota";

export type SilentAuditSummary = {
  publicScanId: string;
  exposureScore: number;
  brokersFound: number;
  riskLevel: string;
  sourcesDetected: number;
  removalsInProgress: number;
  verifiedRemovals: number;
};

/**
 * Background audit — DB-only rollup from the latest stored scan (no DeHashed/IntelX/http).
 */
export async function runSilentAutomatedDeepScanAudit(input: {
  userId: string;
  email: string;
  fullName: string | null;
  stateCode: string;
  subscriptionStartedAt: Date;
}): Promise<SilentAuditSummary> {
  const prior = await prisma.scan.findFirst({
    where: { userId: input.userId },
    orderBy: { createdAt: "desc" }
  });

  const discoveryJson =
    prior?.discoveryJson && typeof prior.discoveryJson === "object"
      ? {
          ...(prior.discoveryJson as Record<string, unknown>),
          auditSource: "automated_silent",
          auditedAt: new Date().toISOString(),
          priorScanId: prior.publicScanId
        }
      : {
          provider: "automated_silent",
          auditSource: "automated_silent",
          auditedAt: new Date().toISOString(),
          breaches: []
        };

  const exposureScore = prior?.exposureScore ?? 0;
  const brokersFound = prior?.brokersFound ?? 0;
  const riskLevel = prior?.riskLevel ?? "LOW";
  const publicScanId = crypto.randomUUID();

  await prisma.scan.create({
    data: {
      publicScanId,
      userId: input.userId,
      exposureScore,
      brokersFound,
      state: input.stateCode || prior?.state || "NA",
      riskLevel,
      fullName: input.fullName || prior?.fullName || null,
      email: input.email,
      discoveryJson
    }
  });

  await recordDeepScanUsage({
    userId: input.userId,
    kind: "automated_audit",
    subscriptionStartedAt: input.subscriptionStartedAt,
    publicScanId
  });

  const removalJobs = await prisma.removalJob.findMany({
    where: { userId: input.userId },
    select: { status: true }
  });

  const removalsInProgress = removalJobs.filter((j) => j.status === "pending" || j.status === "sent").length;
  const verifiedRemovals = removalJobs.filter((j) => j.status === "verified").length;

  let sourcesDetected = brokersFound;
  if (discoveryJson && typeof discoveryJson === "object" && Array.isArray((discoveryJson as { breaches?: unknown }).breaches)) {
    sourcesDetected = Math.max(sourcesDetected, (discoveryJson as { breaches: unknown[] }).breaches.length);
  }

  return {
    publicScanId,
    exposureScore,
    brokersFound,
    riskLevel,
    sourcesDetected,
    removalsInProgress,
    verifiedRemovals
  };
}
