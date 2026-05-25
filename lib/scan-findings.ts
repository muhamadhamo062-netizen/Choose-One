import type { DiscoveryResult } from "@/lib/types/discovery";
import type { RiskAnalysisResult } from "@/lib/risk-analysis";

/** Labels for UI — only from discovery + risk (no mock exposure items). */
export function buildFindingLabels(discovery: DiscoveryResult, risk: RiskAnalysisResult): string[] {
  const labels: string[] = [];
  for (const f of risk.factors) {
    labels.push(f);
  }
  if (discovery.brokerSources.length > 0) {
    labels.push(`Public broker index hits: ${discovery.brokerSources.join(", ")}`);
  }
  if (discovery.possibleAddresses.length > 0) {
    labels.push(`${discovery.possibleAddresses.length} address line(s) returned from sources (review in secure report).`);
  }
  if (discovery.phones.length > 0) {
    labels.push(`${discovery.phones.length} phone line(s) returned from sources.`);
  }
  return labels;
}
