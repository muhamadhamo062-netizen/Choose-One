const seqByRegion = new Map<string, number>();
const lastByScan = new Map<string, { ts: number; region: string; seq: number }>();

export function nextRegionalSequence(region: string): number {
  const next = (seqByRegion.get(region) ?? 0) + 1;
  seqByRegion.set(region, next);
  return next;
}

export function assignLogicalOrdering(scanId: string | null | undefined, region: string): {
  logicalTimestamp: number;
  sequenceNumber: number;
} {
  const sequenceNumber = nextRegionalSequence(region);
  const logicalTimestamp = Date.now();
  if (scanId) {
    lastByScan.set(scanId, { ts: logicalTimestamp, region, seq: sequenceNumber });
  }
  return { logicalTimestamp, sequenceNumber };
}

export function resolveConflict(
  incoming: { region: string; logicalTimestamp: number; sequenceNumber: number },
  existing: { region: string; logicalTimestamp: number; sequenceNumber: number }
): "incoming_wins" | "existing_wins" {
  if (incoming.region === existing.region) {
    if (incoming.logicalTimestamp > existing.logicalTimestamp) {
      return "incoming_wins";
    }
    if (incoming.logicalTimestamp < existing.logicalTimestamp) {
      return "existing_wins";
    }
    return incoming.sequenceNumber >= existing.sequenceNumber ? "incoming_wins" : "existing_wins";
  }
  // primary-region-wins policy
  const primary = process.env.ANALYTICS_PRIMARY_REGION ?? "us-east";
  if (incoming.region === primary && existing.region !== primary) {
    return "incoming_wins";
  }
  if (existing.region === primary && incoming.region !== primary) {
    return "existing_wins";
  }
  return incoming.logicalTimestamp >= existing.logicalTimestamp ? "incoming_wins" : "existing_wins";
}
