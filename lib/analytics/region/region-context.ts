type Region = "us-east" | "eu-west" | "ap-south";

const DEFAULT_REGION: Region = "us-east";
let activeRegion: Region = ((process.env.ANALYTICS_ACTIVE_REGION ?? DEFAULT_REGION) as Region);
const regionSchemaVersion = new Map<string, number>();

function configuredRegions(): Region[] {
  const raw = process.env.ANALYTICS_REGIONS ?? "us-east,eu-west,ap-south";
  const regions = raw
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean) as Region[];
  return regions.length > 0 ? regions : [DEFAULT_REGION];
}

for (const r of configuredRegions()) {
  const envKey = `ANALYTICS_SCHEMA_VERSION_${r.toUpperCase().replace("-", "_")}`;
  const v = Number(process.env[envKey] ?? process.env.ANALYTICS_SCHEMA_VERSION ?? "1");
  regionSchemaVersion.set(r, Number.isFinite(v) && v > 0 ? Math.floor(v) : 1);
}

export function detectRegionFromRequest(req?: { headers?: Headers | Record<string, string | undefined> }): Region {
  const fallback = getActiveRegion();
  if (!req?.headers) {
    return fallback;
  }
  const hdr = req.headers as Headers;
  const source =
    (typeof hdr.get === "function" ? hdr.get("x-region") : (req.headers as Record<string, string | undefined>)["x-region"]) ??
    (typeof hdr.get === "function" ? hdr.get("x-vercel-id") : undefined) ??
    "";
  const lower = source.toLowerCase();
  if (lower.includes("eu")) {
    return "eu-west";
  }
  if (lower.includes("ap")) {
    return "ap-south";
  }
  if (lower.includes("us")) {
    return "us-east";
  }
  return fallback;
}

export function getActiveRegion(): Region {
  const regions = configuredRegions();
  if (!regions.includes(activeRegion)) {
    activeRegion = regions[0] ?? DEFAULT_REGION;
  }
  return activeRegion;
}

export function setActiveRegion(region: string): void {
  const regions = configuredRegions();
  if (regions.includes(region as Region)) {
    activeRegion = region as Region;
  }
}

export function isPrimaryRegion(region = getActiveRegion()): boolean {
  const primary = (process.env.ANALYTICS_PRIMARY_REGION ?? DEFAULT_REGION) as Region;
  return region === primary;
}

export function getFailoverRegion(current = getActiveRegion()): Region {
  const regions = configuredRegions();
  const idx = regions.indexOf(current);
  if (idx < 0 || regions.length === 1) {
    return current;
  }
  return regions[(idx + 1) % regions.length]!;
}

export function attachRegionToEvent<T extends { metadata?: Record<string, unknown> }>(event: T, region = getActiveRegion()): T {
  return {
    ...event,
    metadata: {
      ...(event.metadata ?? {}),
      region
    }
  };
}

export function getRegionSchemaVersion(region = getActiveRegion()): number {
  return regionSchemaVersion.get(region) ?? 1;
}

export function getRegionSchemaVersionMap(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of regionSchemaVersion.entries()) {
    out[k] = v;
  }
  return out;
}
