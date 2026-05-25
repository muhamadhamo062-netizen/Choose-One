import { analyzeRisk } from "@/lib/risk-analysis";
import { getQueueJobByPublicId } from "@/lib/queue/scan-queue";
import { prisma } from "@/lib/prisma";
import { safeDbResult } from "@/lib/safe-db";
import { getStateLabel } from "@/lib/us-states";
import { buildExposuresFromDiscovery, type ExposureItem } from "@/lib/exposure-engine";
import type { DiscoveryResult } from "@/lib/types/discovery";
import type { RiskAnalysisResult } from "@/lib/risk-analysis";
import { runDeletionVerification } from "@/lib/verification/verification-engine";

export type ScanStatusSuccess = {
  ok: true;
  status: "started" | "processing" | "failed" | "completed";
  scanId: string;
  jobId?: string;
  jobStatus: string;
  stateCode?: string;
  stateLabel?: string;
  discovery?: DiscoveryResult;
  risk?: RiskAnalysisResult;
  exposures?: ExposureItem[];
  lastError?: string;
  results?: {
    totalFindings: number;
    categories: {
      emails: string[];
      phones: string[];
      addresses: string[];
    };
    sources: string[];
  };
  verification: {
    status: "pending_verification" | "verifying" | "verified_deleted" | "partial_deleted" | "not_confirmed";
    confidenceScore: number;
    sourcesChecked: number;
    verifiedSources: number;
    failedSources: number;
  };
};

/**
 * Polling read-model for a scan: job state, then completed Scan + discovery.
 */
export async function getScanStatusPayload(
  publicScanId: string
): Promise<ScanStatusSuccess | { ok: false; error: "not_found" }> {
  const job = await getQueueJobByPublicId(publicScanId);
  const jobId = job && "id" in job ? String((job as { id: string }).id) : undefined;
  const st = job ? (job as { status: string }).status : null;

  if (st === "pending" || st === "processing") {
    return {
      ok: true,
      status: st === "pending" ? "started" : "processing",
      scanId: publicScanId,
      jobId,
      jobStatus: st,
      verification: {
        status: st === "pending" ? "pending_verification" : "verifying",
        confidenceScore: 0,
        sourcesChecked: 0,
        verifiedSources: 0,
        failedSources: 0
      }
    };
  }
  if (st === "failed") {
    return {
      ok: true,
      status: "failed",
      scanId: publicScanId,
      jobId,
      jobStatus: st,
      lastError: (job as { lastError?: string | null }).lastError ?? undefined,
      verification: {
        status: "not_confirmed",
        confidenceScore: 0,
        sourcesChecked: 0,
        verifiedSources: 0,
        failedSources: 0
      }
    };
  }

  const scanRes = await safeDbResult(() => prisma.scan.findUnique({ where: { publicScanId } }));
  if (!scanRes.ok) {
    return { ok: false, error: "not_found" };
  }
  const scan = scanRes.value;
  if (!scan) {
    if (job) {
      return {
        ok: true,
        status: "processing",
        scanId: publicScanId,
        jobId,
        jobStatus: (job as { status: string }).status,
        verification: {
          status: "verifying",
          confidenceScore: 0,
          sourcesChecked: 0,
          verifiedSources: 0,
          failedSources: 0
        }
      };
    }
    return { ok: false, error: "not_found" };
  }

  const stateCode = scan.state;
  const stateLabel = getStateLabel(stateCode);
  const discovery = scan.discoveryJson
    ? (JSON.parse(JSON.stringify(scan.discoveryJson)) as DiscoveryResult)
    : null;
  const verification = await runDeletionVerification({
    requestId: publicScanId,
    userId: scan.userId ?? null,
    subject: {
      fullName: discovery?.name || undefined,
      email: scan.email || undefined,
      stateCode,
      stateLabel
    },
    sources: discovery?.brokerSources ?? []
  });

  if (!discovery) {
    return {
      ok: true,
      status: "completed",
      scanId: publicScanId,
      jobId,
      jobStatus: "completed",
      stateCode,
      stateLabel,
      results: {
        totalFindings: 0,
        categories: {
          emails: [],
          phones: [],
          addresses: []
        },
        sources: []
      },
      verification: {
        status: verification.status,
        confidenceScore: verification.verification.confidenceScore,
        sourcesChecked: verification.verification.sourcesChecked,
        verifiedSources: verification.verification.verifiedSources,
        failedSources: verification.verification.failedSources
      }
    };
  }
  const risk = analyzeRisk(discovery);
  const exposures = buildExposuresFromDiscovery(discovery, risk);
  const emails = Array.from(new Set(discovery.emails.filter((v) => typeof v === "string" && v.trim())));
  const phones = Array.from(new Set(discovery.phones.filter((v) => typeof v === "string" && v.trim())));
  const addresses = Array.from(
    new Set(discovery.possibleAddresses.filter((v) => typeof v === "string" && v.trim()))
  );
  const sources = Array.from(new Set(discovery.brokerSources.filter((v) => typeof v === "string" && v.trim())));
  const totalFindings = emails.length + phones.length + addresses.length;
  return {
    ok: true,
    status: "completed",
    scanId: publicScanId,
    jobId,
    jobStatus: "completed",
    stateCode,
    stateLabel,
    discovery,
    risk,
    exposures,
    results: {
      totalFindings,
      categories: {
        emails,
        phones,
        addresses
      },
      sources
    },
    verification: {
      status: verification.status,
      confidenceScore: verification.verification.confidenceScore,
      sourcesChecked: verification.verification.sourcesChecked,
      verifiedSources: verification.verification.verifiedSources,
      failedSources: verification.verification.failedSources
    }
  };
}
