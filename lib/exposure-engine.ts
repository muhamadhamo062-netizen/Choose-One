import { discoverIdentity } from "@/lib/data-discovery-engine";
import { analyzeRisk, type RiskAnalysisResult } from "@/lib/risk-analysis";
import { getStateLabel } from "@/lib/us-states";
import type { DiscoveryResult } from "@/lib/types/discovery";

/**
 * Public / simulated / connector-backed exposure analysis — not unauthorized access
 * to private accounts. Aligns with opt-out and public-index style signals only.
 */
export type ExposureCategory = "address" | "phone" | "email" | "relatives";

export type ExposureSeverity = "low" | "medium" | "high";

export interface ExposureItem {
  category: ExposureCategory;
  severity: ExposureSeverity;
  /** Human-readable source labels: broker names, public index, simulation, etc. */
  sources: string[];
}

/**
 * Modular engine contract for future real API connectors; default implementation
 * uses the existing discovery + risk stack.
 */
export interface ExposureEngine {
  runIdentityScan(input: {
    name?: string;
    email?: string;
    state: string;
  }): Promise<{
    score: number;
    exposures: ExposureItem[];
  }>;
}

function severityFromCount(count: number, _hasBrokers: boolean): ExposureSeverity {
  if (count >= 3) {
    return "high";
  }
  if (count >= 1) {
    return "medium";
  }
  return "low";
}

const SIM_BASE = "State-level public index (aggregated signal simulation)";
const BREACH_PLACEHOLDER = "Breach / leak intelligence (placeholders until API layer)";

/**
 * Map discovery + risk into the four product categories. “Relatives” is derived/aggregated
 * from people-search style indices — not private account access.
 */
export function buildExposuresFromDiscovery(
  discovery: DiscoveryResult,
  _risk: RiskAnalysisResult
): ExposureItem[] {
  const hasBrokers = discovery.brokerSources.length > 0;
  const brokerLabel = (s: string) => s;

  const addressSources: string[] = [];
  if (discovery.possibleAddresses.length > 0) {
    addressSources.push("Public & people-search address fields (where matched)");
  } else {
    addressSources.push(hasBrokers ? "Broker index: address class signals" : SIM_BASE);
  }

  const phoneSources: string[] = [];
  if (discovery.phones.length > 0) {
    phoneSources.push("Public directory / broker phone index fields (where matched)");
  } else {
    phoneSources.push(SIM_BASE);
  }

  const emailSources: string[] = [];
  if (discovery.emails.length > 0) {
    emailSources.push("Subject email field (you provided) and broker index matches (where any)");
  } else {
    emailSources.push("Public email directory signals (aggregated) — " + BREACH_PLACEHOLDER);
  }

  const relativeSources: string[] = hasBrokers
    ? [
        "People-search household / relative graph (aggregated, public index class)",
        ...discovery.brokerSources.slice(0, 3).map(brokerLabel)
      ]
    : [SIM_BASE, "No broker graph match without configured connectors — model uses jurisdiction baseline only"];

  const addrSev = severityFromCount(discovery.possibleAddresses.length, hasBrokers);
  const phoneSev = severityFromCount(discovery.phones.length, hasBrokers);
  const emailSev = severityFromCount(discovery.emails.length, hasBrokers);
  const relSev: ExposureSeverity = hasBrokers && discovery.brokerSources.length >= 2 ? "high" : hasBrokers ? "medium" : "low";

  return [
    { category: "address", severity: addrSev, sources: addressSources },
    { category: "phone", severity: phoneSev, sources: phoneSources },
    { category: "email", severity: emailSev, sources: emailSources },
    { category: "relatives", severity: relSev, sources: relativeSources }
  ];
}

/**
 * End-to-end scan for the pipeline: discovery → risk → category breakdown.
 * Used by `createScanInDatabase` and parity checks — not a second “access layer.”
 */
export async function runIdentityScanPipeline(input: {
  name?: string;
  email?: string;
  state: string;
}): Promise<{
  score: number;
  exposures: ExposureItem[];
  discovery: DiscoveryResult;
  risk: RiskAnalysisResult;
}> {
  const stateLabel = getStateLabel(input.state);
  const fullName = (input.name ?? "").trim() || "Unknown";
  const discovery = await discoverIdentity({
    fullName,
    email: input.email,
    stateCode: input.state,
    stateLabel
  });
  const risk = analyzeRisk(discovery);
  const exposures = buildExposuresFromDiscovery(discovery, risk);
  return {
    score: risk.exposureScore,
    exposures,
    discovery,
    risk
  };
}

export const defaultExposureEngine: ExposureEngine = {
  async runIdentityScan(input) {
    const out = await runIdentityScanPipeline(input);
    return { score: out.score, exposures: out.exposures };
  }
};
