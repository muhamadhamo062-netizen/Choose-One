import { randomUUID } from "crypto";
import { trackAnalyticsEvent } from "@/lib/analytics/analytics-events";
import { emitScanRealtime } from "@/lib/realtime/emit-scan-realtime";
import { prisma } from "@/lib/prisma";
import { safeDbResult } from "@/lib/safe-db";
import { getStateLabel } from "@/lib/us-states";
import { runIdentityScanPipeline } from "@/lib/exposure-engine";
import type { DiscoveryResult } from "@/lib/types/discovery";
import type { RiskAnalysisResult } from "@/lib/risk-analysis";

export async function createScanInDatabase(input: {
  fullName: string;
  email?: string;
  stateCode: string;
  userId?: string | null;
  /** When set (e.g. from a queued job), Scan + session use this id instead of generating a new UUID. */
  publicScanId?: string;
}): Promise<{
  scanId: string;
  discovery: DiscoveryResult;
  risk: RiskAnalysisResult;
  stateCode: string;
  stateLabel: string;
}> {
  const stateLabel = getStateLabel(input.stateCode);
  const publicScanId = input.publicScanId ?? randomUUID();
  const userId = input.userId ?? null;

  await emitScanRealtime({
    eventName: "scan_progress",
    scanId: publicScanId,
    userId,
    payload: { stage: "discovery", progress: 22 }
  });
  const { discovery, risk } = await runIdentityScanPipeline({
    name: input.fullName,
    email: input.email,
    state: input.stateCode
  });
  const brokerN = discovery.brokerSources.length;
  await emitScanRealtime({
    eventName: "scan_progress",
    scanId: publicScanId,
    userId,
    payload: { stage: "aggregation", progress: 48, brokerCount: brokerN }
  });
  await emitScanRealtime({
    eventName: "risk_calculated",
    scanId: publicScanId,
    userId,
    payload: {
      riskLevel: risk.riskLevel,
      exposureScore: risk.exposureScore,
      factors: risk.factors,
      stateCode: input.stateCode
    }
  });
  await emitScanRealtime({
    eventName: "scan_progress",
    scanId: publicScanId,
    userId,
    payload: { stage: "analysis", progress: 62, riskLevel: risk.riskLevel }
  });
  await emitScanRealtime({
    eventName: "scan_progress",
    scanId: publicScanId,
    userId,
    payload: { stage: "persist", progress: 82 }
  });

  const txRes = await safeDbResult(() =>
    prisma.$transaction(async (tx) => {
      const row = await tx.scan.create({
        data: {
          publicScanId,
          userId,
          exposureScore: risk.exposureScore,
          brokersFound: brokerN,
          state: input.stateCode,
          riskLevel: risk.riskLevel,
          fullName: discovery.name || input.fullName || null,
          email: input.email?.trim() || null,
          discoveryJson: JSON.parse(JSON.stringify(discovery)) as object
        }
      });
      await tx.scanSession.create({
        data: {
          scanDbId: row.id,
          publicScanId: row.publicScanId,
          email: input.email?.trim() || null,
          state: input.stateCode,
          exposureScore: risk.exposureScore,
          brokersFound: brokerN
        }
      });
    })
  );
  if (!txRes.ok) {
    throw new Error("scan_persist_unavailable");
  }

  await emitScanRealtime({
    eventName: "scan_progress",
    scanId: publicScanId,
    userId,
    payload: { stage: "sealed", progress: 95 }
  });
  await trackAnalyticsEvent({
    type: "scan_completed",
    userId,
    scanId: publicScanId,
    metadata: {
      stateCode: input.stateCode,
      exposureScore: risk.exposureScore,
      sourcesFound: brokerN
    }
  });
  await trackAnalyticsEvent({
    type: "discovery_found",
    userId,
    scanId: publicScanId,
    metadata: {
      sourcesFound: brokerN,
      sources: discovery.brokerSources
    }
  });

  return {
    scanId: publicScanId,
    discovery,
    risk,
    stateCode: input.stateCode,
    stateLabel
  };
}
