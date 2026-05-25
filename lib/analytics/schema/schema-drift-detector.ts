import { publishObservabilitySignal } from "@/lib/analytics/observability-bus";
import { getRegionSchemaVersionMap } from "@/lib/analytics/region/region-context";

type DriftItem = {
  region: string;
  expected: number;
  actual: number;
  type: string;
};

const driftItems: DriftItem[] = [];

export function recordSchemaDrift(item: DriftItem): void {
  driftItems.unshift(item);
  if (driftItems.length > 200) {
    driftItems.length = 200;
  }
  publishObservabilitySignal({
    type: "SCHEMA_DRIFT_DETECTED",
    severity: "warn",
    payload: item
  });
}

export function detectRegionSchemaDrift(activeRegion: string): DriftItem[] {
  const versions = getRegionSchemaVersionMap();
  const expected = versions[activeRegion] ?? 1;
  const out: DriftItem[] = [];
  for (const [region, actual] of Object.entries(versions)) {
    if (actual !== expected) {
      out.push({ region, expected, actual, type: "region_version_mismatch" });
    }
  }
  for (const d of out) {
    recordSchemaDrift(d);
  }
  return out;
}

export function getSchemaDriftReport() {
  return {
    driftCount: driftItems.length,
    items: driftItems.slice(0, 100)
  };
}
