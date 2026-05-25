import { trackAnalyticsEvent } from "@/lib/analytics/analytics-events";
import { writeVerificationAuditLog, type VerificationDecision } from "@/lib/verification/audit-log";

const SOURCE_TIMEOUT_MS = 4000;
const TOTAL_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 60_000;

type VerificationStatus = VerificationDecision | "pending_verification" | "verifying";

export type DeletionRequestResult = {
  requestId: string;
  userId?: string | null;
  subject: {
    fullName?: string;
    email?: string;
    stateCode?: string;
    stateLabel?: string;
  };
  sources: string[];
};

export type SourceVerificationResult = {
  source: string;
  found: boolean | "unknown";
  confidence: number;
};

export type VerificationSummary = {
  status: VerificationStatus;
  verification: {
    confidenceScore: number;
    sourcesChecked: number;
    verifiedSources: number;
    failedSources: number;
    totalSourcesChecked: number;
    sourcesNotFound: number;
    finalConfidenceScore: number;
    sourceResults: SourceVerificationResult[];
  };
};

const cache = new Map<string, { at: number; value: VerificationSummary }>();

function clampConfidence(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function decideStatus(score: number): VerificationDecision {
  if (score >= 90) {
    return "verified_deleted";
  }
  if (score >= 50) {
    return "partial_deleted";
  }
  return "not_confirmed";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });
  return (await Promise.race([promise, timeout])) as T | null;
}

async function verifyOneSource(
  source: string,
  subject: DeletionRequestResult["subject"]
): Promise<SourceVerificationResult> {
  const url = process.env.PE_DISCOVERY_CONNECTOR_URL;
  if (!url) {
    return { source, found: "unknown", confidence: 0 };
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.PE_DISCOVERY_CONNECTOR_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const request = fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fullName: subject.fullName,
      email: subject.email,
      stateCode: subject.stateCode,
      stateLabel: subject.stateLabel,
      sourceHint: source,
      mode: "verification_recheck"
    })
  }).then(async (res) => {
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as Record<string, unknown>;
  });

  const payload = await withTimeout(request, SOURCE_TIMEOUT_MS);
  if (!payload) {
    return { source, found: "unknown", confidence: 0 };
  }

  const explicitFound = payload.found;
  if (typeof explicitFound === "boolean") {
    const explicitConfidence = typeof payload.confidence === "number" ? payload.confidence : explicitFound ? 0 : 100;
    return {
      source,
      found: explicitFound,
      confidence: clampConfidence(explicitConfidence)
    };
  }

  const brokerSources = Array.isArray(payload.brokerSources)
    ? payload.brokerSources.filter((v): v is string => typeof v === "string")
    : [];
  const found = brokerSources.some((s) => s.toLowerCase() === source.toLowerCase());
  return {
    source,
    found,
    confidence: found ? 0 : 100
  };
}

function aggregate(results: SourceVerificationResult[]) {
  if (results.length === 0) {
    return { score: 0, sourcesNotFound: 0, verifiedSources: 0, failedSources: 0 };
  }
  let weightedSum = 0;
  let weightTotal = 0;
  let sourcesNotFound = 0;
  let verifiedSources = 0;
  let failedSources = 0;

  for (const row of results) {
    const weight = 1;
    const confidence = clampConfidence(row.confidence);
    weightedSum += confidence * weight;
    weightTotal += weight;
    if (row.found === false) {
      sourcesNotFound += 1;
      verifiedSources += 1;
    } else {
      failedSources += 1;
    }
  }
  const score = weightTotal > 0 ? clampConfidence(weightedSum / weightTotal) : 0;
  return { score, sourcesNotFound, verifiedSources, failedSources };
}

export async function runDeletionVerification(input: DeletionRequestResult): Promise<VerificationSummary> {
  const cached = cache.get(input.requestId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  const start = Date.now();
  await trackAnalyticsEvent({
    type: "verification_started",
    userId: input.userId ?? null,
    scanId: input.requestId,
    metadata: { sourceCount: input.sources.length }
  });
  const uniqueSources = Array.from(new Set(input.sources.map((s) => s.trim()).filter(Boolean)));
  const checks = uniqueSources.map((source) => verifyOneSource(source, input.subject));
  const resolved = await withTimeout(Promise.all(checks), TOTAL_TIMEOUT_MS);
  const sourceResults = resolved ?? uniqueSources.map((source) => ({ source, found: "unknown" as const, confidence: 0 }));
  const agg = aggregate(sourceResults);
  const decision = decideStatus(agg.score);

  const output: VerificationSummary = {
    status: decision,
    verification: {
      confidenceScore: agg.score,
      sourcesChecked: sourceResults.length,
      verifiedSources: agg.verifiedSources,
      failedSources: agg.failedSources,
      totalSourcesChecked: sourceResults.length,
      sourcesNotFound: agg.sourcesNotFound,
      finalConfidenceScore: agg.score,
      sourceResults
    }
  };
  await trackAnalyticsEvent({
    type: "verification_completed",
    userId: input.userId ?? null,
    scanId: input.requestId,
    metadata: {
      finalScore: agg.score,
      sourcesChecked: sourceResults.length,
      decision
    }
  });
  await trackAnalyticsEvent({
    type: decision,
    userId: input.userId ?? null,
    scanId: input.requestId,
    metadata: {
      finalScore: agg.score,
      sourcesChecked: sourceResults.length
    }
  });

  await writeVerificationAuditLog({
    requestId: input.requestId,
    sourcesChecked: sourceResults.length,
    finalScore: agg.score,
    decision,
    sourceResults,
    durationMs: Date.now() - start
  });

  cache.set(input.requestId, { at: Date.now(), value: output });
  return output;
}
