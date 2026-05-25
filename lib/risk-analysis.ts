import type { DiscoveryResult } from "@/lib/types/discovery";

/** Product-facing risk bucket for UI and analytics. */
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskAnalysisResult {
  exposureScore: number;
  riskLevel: RiskLevel;
  /** Human-readable factors used in scoring (auditable, no fabricated PII). */
  factors: string[];
}

/**
 * Computes 0–100 exposure and a risk level from **retrieved** discovery fields only.
 * Does not invent broker counts — uses `brokerSources.length` and attribute presence.
 */
export function analyzeRisk(discovery: DiscoveryResult): RiskAnalysisResult {
  const factors: string[] = [];
  const brokerCount = discovery.brokerSources.length;

  let score = 0;
  if (brokerCount > 0) {
    const brokerPoints = Math.min(75, brokerCount * 15);
    score += brokerPoints;
    factors.push(`${brokerCount} broker source(s) matched`);
  }
  if (discovery.phones.length > 0) {
    const p = Math.min(20, discovery.phones.length * 7);
    score += p;
    factors.push(`${discovery.phones.length} phone number(s) returned from sources`);
  }
  if (discovery.possibleAddresses.length > 0) {
    const a = Math.min(20, discovery.possibleAddresses.length * 5);
    score += a;
    factors.push(`${discovery.possibleAddresses.length} address signal(s) returned`);
  }
  if (discovery.emails.length > 0) {
    score += Math.min(10, discovery.emails.length * 3);
    factors.push(`${discovery.emails.length} email field(s) in discovery result`);
  }
  score += Math.round(discovery.confidenceScore * 15);
  if (discovery.confidenceScore > 0) {
    factors.push(`Connector confidence ${Math.round(discovery.confidenceScore * 100)}%`);
  }

  if (brokerCount === 0 && score < 8 && discovery.provenance === "no_connector_configured") {
    factors.push("No external discovery connector — score reflects input context only");
  }

  score = Math.min(100, Math.round(score));

  let riskLevel: RiskLevel = "LOW";
  if (score >= 85) {
    riskLevel = "CRITICAL";
  } else if (score >= 60) {
    riskLevel = "HIGH";
  } else if (score >= 30) {
    riskLevel = "MEDIUM";
  }

  return { exposureScore: score, riskLevel, factors };
}
