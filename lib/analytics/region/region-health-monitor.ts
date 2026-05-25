import { getProjectionQueueDepths } from "@/lib/analytics/event-queue";
import { getActiveRegion } from "@/lib/analytics/region/region-context";

type RegionHealth = {
  latencyMs: number;
  queueBacklog: number;
  replicationLagMs: number;
  errorRate: number;
  healthy: boolean;
  updatedAt: string;
};

const cache = new Map<string, RegionHealth>();

export function updateRegionHealth(region: string, patch: Partial<RegionHealth>): void {
  const prev = cache.get(region);
  const next: RegionHealth = {
    latencyMs: patch.latencyMs ?? prev?.latencyMs ?? 0,
    queueBacklog: patch.queueBacklog ?? prev?.queueBacklog ?? 0,
    replicationLagMs: patch.replicationLagMs ?? prev?.replicationLagMs ?? 0,
    errorRate: patch.errorRate ?? prev?.errorRate ?? 0,
    healthy: patch.healthy ?? prev?.healthy ?? true,
    updatedAt: new Date().toISOString()
  };
  cache.set(region, next);
}

export async function refreshLocalRegionHealth(): Promise<void> {
  const region = getActiveRegion();
  const start = Date.now();
  const queue = await getProjectionQueueDepths();
  const latencyMs = Date.now() - start;
  const queueBacklog = queue.queue_depth_high + queue.queue_depth_normal + queue.queue_depth_low;
  const replicationLagMs = Number(process.env.ANALYTICS_REPLICATION_LAG_MS ?? "0");
  const errorRate = Number(process.env.ANALYTICS_REGION_ERROR_RATE ?? "0");
  const healthy = latencyMs < 1000 && queueBacklog < 5000 && errorRate < 0.2;
  updateRegionHealth(region, { latencyMs, queueBacklog, replicationLagMs, errorRate, healthy });
}

export function getRegionHealth() {
  const obj: Record<string, RegionHealth> = {};
  for (const [k, v] of cache.entries()) {
    obj[k] = v;
  }
  return obj;
}

export function isRegionHealthy(region: string): boolean {
  const r = cache.get(region);
  return r?.healthy ?? true;
}
