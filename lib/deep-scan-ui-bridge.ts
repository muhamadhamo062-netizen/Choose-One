import { buildExposuresFromDiscovery, type ExposureItem } from "@/lib/exposure-engine";
import { analyzeRisk, type RiskAnalysisResult } from "@/lib/risk-analysis";
import type { DiscoveryResult } from "@/lib/types/discovery";

/** Maps deep-scan API payload into discovery/risk models so the main “shock” exposure rows render without the queue worker. */
export function discoveryRiskExposuresFromDeepScan(input: {
  fullName: string;
  email: string;
  breaches: Array<{ source: string }>;
  identity?: {
    addresses: Array<{ city: string; state: string; streetMasked: string }>;
    phones: string[];
    brokers: Array<{ name: string; status: "EXPOSED" | "NO_SIGNAL" }>;
  } | null;
}): {
  discovery: DiscoveryResult;
  risk: RiskAnalysisResult;
  exposures: ExposureItem[];
} {
  const brokerSources = [
    ...new Set([
      ...input.breaches.map((b) => b.source).filter((s) => typeof s === "string" && s.trim().length > 0),
      ...(input.identity?.brokers.filter((b) => b.status === "EXPOSED").map((b) => b.name) ?? [])
    ])
  ];
  const possibleAddresses = (input.identity?.addresses ?? []).map((a) => `${a.streetMasked}, ${a.city}, ${a.state}`);
  const phones = [...(input.identity?.phones ?? [])];
  const discovery: DiscoveryResult = {
    name: input.fullName.trim() || "Unknown",
    possibleAddresses,
    phones,
    emails: input.email.trim() ? [input.email.trim()] : [],
    brokerSources,
    confidenceScore: Math.min(1, 0.25 + Math.min(input.breaches.length, 12) * 0.06),
    provenance:
      brokerSources.length > 0 || input.breaches.length > 0
        ? "connector"
        : input.identity?.addresses?.length || input.identity?.phones?.length
          ? "connector"
          : "input_only"
  };
  const risk = analyzeRisk(discovery);
  const exposures = buildExposuresFromDiscovery(discovery, risk);
  return { discovery, risk, exposures };
}
