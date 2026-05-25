import { processProjectionQueueBatch } from "@/lib/workers/analytics-projection-worker";
import { retryFailedEvents } from "@/lib/analytics/event-queue";
import { computeMaterializedFromRawEvents, replaceMaterializedMetrics } from "@/lib/analytics/materialized-metrics";
import type { SystemHealthReport } from "@/lib/analytics/system-health-scoring";
import { assertSystemAllowed } from "@/lib/analytics/system-control-plane";
import { publishObservabilitySignal } from "@/lib/analytics/observability-bus";
import { isWriteAllowed } from "@/lib/analytics/global-write-fence";
import { recordStateChange, shouldAllowTransition } from "@/lib/analytics/system-stability-governor";

let healingInProgress = false;
let lastRunAt: string | null = null;
let lastResult: "idle" | "started" | "done" | "failed" = "idle";

export function getHealingState() {
  return {
    healingInProgress,
    lastRunAt,
    lastResult
  };
}

export function triggerAutoHealing(report: SystemHealthReport): void {
  void (async () => {
    const fenceAllowed = await isWriteAllowed("healing");
    if (!fenceAllowed) {
      return;
    }
  const guard = assertSystemAllowed("healing");
  if (!guard.allowed) {
    return;
  }
  const transitionAllowed = shouldAllowTransition("healing", "started");
  if (!transitionAllowed) {
    return;
  }
  if (report.status === "healthy" || healingInProgress) {
    return;
  }
  healingInProgress = true;
  recordStateChange("healing", "started");
  lastResult = "started";
  lastRunAt = new Date().toISOString();
  queueMicrotask(() => {
    void (async () => {
      try {
        publishObservabilitySignal({
          type: "auto_healing_started",
          severity: "warn",
          payload: { status: report.status }
        });
        await retryFailedEvents(100);
        await processProjectionQueueBatch(100);
        if (report.status === "critical") {
          const recomputed = await computeMaterializedFromRawEvents();
          await replaceMaterializedMetrics(recomputed);
        }
        lastResult = "done";
        recordStateChange("healing", "done");
        publishObservabilitySignal({
          type: "auto_healing_done",
          severity: "info",
          payload: { status: report.status }
        });
      } catch {
        lastResult = "failed";
        recordStateChange("healing", "failed");
        publishObservabilitySignal({
          type: "auto_healing_failed",
          severity: "error",
          payload: { status: report.status }
        });
      } finally {
        healingInProgress = false;
      }
    })();
  });
  })();
}
