import { ensureBootstrapValidated } from "@/lib/analytics/system-bootstrap-validator";
import { publishObservabilitySignal } from "@/lib/analytics/observability-bus";
import { captureRecoveryPoint } from "@/lib/analytics/recovery-points";
import { handleSystemModeFence } from "@/lib/analytics/global-write-fence";
import { recordStateChange, shouldAllowTransition } from "@/lib/analytics/system-stability-governor";
import { getActiveRegion, getFailoverRegion, setActiveRegion } from "@/lib/analytics/region/region-context";
import { getRegionHealth, isRegionHealthy, refreshLocalRegionHealth } from "@/lib/analytics/region/region-health-monitor";
import { detectRegionSchemaDrift } from "@/lib/analytics/schema/schema-drift-detector";
import { getCurrentCostPressure } from "@/lib/analytics/cost/cost-meter";
import { getBudgetStatus } from "@/lib/analytics/cost/cost-budgets";

export type AnalyticsSystemMode = "normal" | "read_only" | "degraded" | "locked";
export type OperationType =
  | "analytics_write"
  | "projection_enqueue"
  | "projection_worker"
  | "replay"
  | "healing";

function effectiveMode(): AnalyticsSystemMode {
  if (process.env.EMERGENCY_DISABLE_ANALYTICS === "true") {
    return "locked";
  }
  const mode = (process.env.ANALYTICS_SYSTEM_MODE ?? "normal").toLowerCase();
  if (mode === "read_only" || mode === "degraded" || mode === "locked") {
    return mode;
  }
  return "normal";
}

let lastObservedMode: AnalyticsSystemMode | null = null;

function handleModeTransition(nextMode: AnalyticsSystemMode): void {
  if (lastObservedMode == null) {
    lastObservedMode = nextMode;
    return;
  }
  if (lastObservedMode === nextMode) {
    return;
  }
  const allow = shouldAllowTransition("system_mode", nextMode);
  if (!allow) {
    return;
  }
  const from = lastObservedMode;
  lastObservedMode = nextMode;
  recordStateChange("system_mode", nextMode);
  publishObservabilitySignal({
    type: "system_mode_transition",
    severity: "warn",
    payload: { from, to: nextMode }
  });
  void captureRecoveryPoint(`mode_transition_${from}_to_${nextMode}`).catch(() => {
    // non-blocking
  });
  void handleSystemModeFence(nextMode).catch(() => {
    // non-blocking
  });
}

export function getSystemControlState() {
  const mode = effectiveMode();
  void refreshLocalRegionHealth().catch(() => {
    // best effort
  });
  const region = getActiveRegion();
  detectRegionSchemaDrift(region);
  const healthy = isRegionHealthy(region);
  if (!healthy && process.env.EMERGENCY_DISABLE_ANALYTICS !== "true") {
    const failover = getFailoverRegion(region);
    if (failover !== region) {
      setActiveRegion(failover);
      publishObservabilitySignal({
        type: "region_failover_activated",
        severity: "warn",
        payload: { from: region, to: failover, regionHealth: getRegionHealth() }
      });
    }
  }
  void handleSystemModeFence(mode).catch(() => {
    // non-blocking
  });
  handleModeTransition(mode);
  const analyticsWritesEnabled = mode === "normal" || mode === "degraded";
  const projectionsEnabled = mode === "normal" || mode === "degraded";
  const replayEnabled = mode !== "locked";
  const healingEnabled = mode === "normal";
  const pressure = getCurrentCostPressure();
  const budgets = getBudgetStatus();
  const backlog = Object.values(getRegionHealth()).reduce((sum, x) => sum + (x.queueBacklog ?? 0), 0);
  const costAwareMode =
    pressure >= 90 || backlog > 3000 || budgets.projectionJobs.exceeded
      ? "cost_throttled"
      : pressure >= 70 || budgets.projectionJobs.throttled || budgets.replay.throttled
        ? "cost_degraded"
        : "normal";
  return {
    systemMode: mode,
    costAwareMode,
    analyticsWritesEnabled,
    projectionsEnabled,
    replayEnabled,
    healingEnabled
  };
}

function isAllowed(op: OperationType, mode: AnalyticsSystemMode): boolean {
  if (mode === "locked") {
    return op === "replay";
  }
  if (mode === "read_only") {
    return op === "replay";
  }
  if (mode === "degraded") {
    return op !== "healing";
  }
  return true;
}

export function assertSystemAllowed(operationType: OperationType): { allowed: boolean; state: ReturnType<typeof getSystemControlState> } {
  ensureBootstrapValidated();
  const state = getSystemControlState();
  const allowed = isAllowed(operationType, state.systemMode);
  if (!allowed) {
    publishObservabilitySignal({
      type: "operation_blocked",
      severity: "warn",
      payload: { operationType, mode: state.systemMode }
    });
  }
  return { allowed, state };
}
