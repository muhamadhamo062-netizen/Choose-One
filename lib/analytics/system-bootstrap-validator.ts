import { prisma } from "@/lib/prisma";
import { publishObservabilitySignal } from "@/lib/analytics/observability-bus";

let validated = false;
let validating: Promise<void> | null = null;

async function tableExists(name: string): Promise<boolean> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1 LIMIT 1`,
    name
  )) as Array<Record<string, unknown>>;
  return rows.length > 0;
}

export async function validateAnalyticsBootstrap(): Promise<{
  ready: boolean;
  checks: Record<string, boolean>;
}> {
  const checks = {
    analytics_events: await tableExists("analytics_events"),
    analytics_projection_queue: await tableExists("analytics_projection_queue"),
    analytics_projection_dead_letter_queue: await tableExists("analytics_projection_dead_letter_queue"),
    analytics_materialized_global: await tableExists("analytics_materialized_global"),
    analytics_materialized_scan: await tableExists("analytics_materialized_scan"),
    analytics_system_state: await tableExists("analytics_system_state")
  };
  const ready = Object.values(checks).every(Boolean);
  publishObservabilitySignal({
    type: "bootstrap_validation",
    severity: ready ? "info" : "error",
    payload: { ready, checks }
  });
  return { ready, checks };
}

export function ensureBootstrapValidated(): void {
  if (validated || validating) {
    return;
  }
  validating = (async () => {
    try {
      await validateAnalyticsBootstrap();
      validated = true;
    } catch (error) {
      publishObservabilitySignal({
        type: "bootstrap_validation_failed",
        severity: "error",
        payload: { message: error instanceof Error ? error.message : String(error) }
      });
    } finally {
      validating = null;
    }
  })();
}
