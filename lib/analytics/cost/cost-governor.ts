import { getBudgetStatus } from "@/lib/analytics/cost/cost-budgets";
import { getCurrentCostPressure } from "@/lib/analytics/cost/cost-meter";

type OperationType =
  | "analytics_write"
  | "projection_enqueue"
  | "projection_worker"
  | "replay"
  | "replication";

const throttledOps: Array<{ at: string; operationType: OperationType; reason: string; pressure: number }> = [];

function pushThrottle(operationType: OperationType, reason: string, pressure: number): void {
  throttledOps.unshift({ at: new Date().toISOString(), operationType, reason, pressure });
  if (throttledOps.length > 200) {
    throttledOps.length = 200;
  }
}

export async function canExecute(operationType: OperationType): Promise<{
  allowed: boolean;
  throttled: boolean;
  delayMs: number;
  degradeSuggestion: "none" | "cost_degraded" | "cost_throttled";
}> {
  const pressure = getCurrentCostPressure();
  const budgets = getBudgetStatus();

  // Critical rule: never block analytics events writes.
  if (operationType === "analytics_write") {
    if (budgets.analyticsWrites.throttled || budgets.analyticsWrites.exceeded || pressure >= 75) {
      const delayMs = pressure >= 90 ? 120 : pressure >= 75 ? 60 : 0;
      if (delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
      pushThrottle(operationType, "advisory_write_throttle", pressure);
      return {
        allowed: true,
        throttled: delayMs > 0,
        delayMs,
        degradeSuggestion: pressure >= 90 ? "cost_throttled" : "cost_degraded"
      };
    }
    return { allowed: true, throttled: false, delayMs: 0, degradeSuggestion: "none" };
  }

  const map = {
    projection_enqueue: budgets.analyticsWrites,
    projection_worker: budgets.projectionJobs,
    replay: budgets.replay,
    replication: budgets.replication
  } as const;
  const selected = map[operationType];

  if (selected.exceeded || pressure >= 95) {
    pushThrottle(operationType, "budget_exceeded", pressure);
    return {
      allowed: operationType !== "replay",
      throttled: true,
      delayMs: 200,
      degradeSuggestion: "cost_throttled"
    };
  }
  if (selected.throttled || pressure >= 75) {
    const delayMs = pressure >= 90 ? 180 : 80;
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    pushThrottle(operationType, "budget_throttled", pressure);
    return {
      allowed: true,
      throttled: true,
      delayMs,
      degradeSuggestion: pressure >= 90 ? "cost_throttled" : "cost_degraded"
    };
  }

  return { allowed: true, throttled: false, delayMs: 0, degradeSuggestion: "none" };
}

export function getThrottledOperations() {
  return throttledOps.slice(0, 100);
}
