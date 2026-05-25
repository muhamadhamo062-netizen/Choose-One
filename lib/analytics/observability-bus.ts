import {
  canEmit,
  getBudgetSnapshot,
  recordAllowed,
  recordCompressed,
  recordSuppressed,
  trackSignal
} from "@/lib/analytics/observability-budget";
import { getCurrentCostPressure } from "@/lib/analytics/cost/cost-meter";

type Severity = "info" | "warn" | "error";

export type ObservabilitySignal = {
  type: string;
  severity: Severity;
  at: string;
  payload: Record<string, unknown>;
};

type AggregatedState = {
  counters: Record<string, number>;
  lastSignals: ObservabilitySignal[];
  breakerStates: Record<string, string>;
  writeFence: Record<string, unknown> | null;
  compressedSignals: Record<string, { count: number; windowStart: string; lastSeverity: Severity }>;
};

const MAX_SIGNALS = 200;

const state: AggregatedState = {
  counters: {},
  lastSignals: [],
  breakerStates: {},
  writeFence: null,
  compressedSignals: {}
};

function pushSignal(row: ObservabilitySignal): void {
  state.counters[row.type] = (state.counters[row.type] ?? 0) + 1;
  state.lastSignals.unshift(row);
  if (state.lastSignals.length > MAX_SIGNALS) {
    state.lastSignals.length = MAX_SIGNALS;
  }
}

function rawEmit(signal: Omit<ObservabilitySignal, "at">): void {
  const row: ObservabilitySignal = { ...signal, at: new Date().toISOString() };
  pushSignal(row);
}

function budgetInternalType(type: string): boolean {
  return type === "SIGNAL_BUDGET_EXCEEDED" || type === "SIGNAL_COMPRESSED" || type === "SIGNAL_EMISSION_ALLOWED";
}

function isCriticalSignal(type: string): boolean {
  return type.includes("FENCE") || type.startsWith("circuit_") || type === "replay_drift_detected";
}

export function publishObservabilitySignal(signal: Omit<ObservabilitySignal, "at">): void {
  // Prevent recursion/noise loops from meta-budget events.
  if (budgetInternalType(signal.type)) {
    rawEmit(signal);
    return;
  }

  const pressure = getCurrentCostPressure();
  if (pressure >= 80 && !isCriticalSignal(signal.type) && signal.severity === "info") {
    return;
  }
  if (pressure >= 90 && !isCriticalSignal(signal.type) && signal.severity !== "error") {
    return;
  }

  trackSignal(signal.type);
  if (canEmit(signal.type)) {
    recordAllowed(signal.type);
    rawEmit(signal);
    rawEmit({
      type: "SIGNAL_EMISSION_ALLOWED",
      severity: "info",
      payload: { signalType: signal.type }
    });
    return;
  }

  recordSuppressed(signal.type);
  recordCompressed(signal.type);
  const key = signal.type;
  const entry = state.compressedSignals[key] ?? {
    count: 0,
    windowStart: new Date().toISOString(),
    lastSeverity: signal.severity
  };
  entry.count += 1;
  entry.lastSeverity = signal.severity;
  state.compressedSignals[key] = entry;

  rawEmit({
    type: "SIGNAL_BUDGET_EXCEEDED",
    severity: "warn",
    payload: {
      signalType: signal.type,
      suppressedCount: entry.count
    }
  });

  rawEmit({
    type: "SIGNAL_COMPRESSED",
    severity: "warn",
    payload: {
      signalType: signal.type,
      batchedType: `${signal.type}_BATCHED`,
      count: entry.count,
      windowStart: entry.windowStart,
      lastSeverity: entry.lastSeverity
    }
  });

  rawEmit({
    type: `${signal.type}_BATCHED`,
    severity: entry.lastSeverity,
    payload: {
      count: entry.count,
      timeWindowSeconds: 60,
      lastSeverity: entry.lastSeverity
    }
  });
}

export function setBreakerState(name: string, value: string): void {
  state.breakerStates[name] = value;
}

export function setWriteFenceState(fence: Record<string, unknown> | null): void {
  state.writeFence = fence;
}

export function getObservabilityState() {
  const budget = getBudgetSnapshot();
  return {
    counters: { ...state.counters },
    breakerStates: { ...state.breakerStates },
    writeFence: state.writeFence ? { ...state.writeFence } : null,
    compressedSignals: { ...state.compressedSignals },
    budget,
    lastSignals: [...state.lastSignals]
  };
}

export function getCriticalSignals(limit = 20): ObservabilitySignal[] {
  return state.lastSignals.filter((s) => s.severity !== "info").slice(0, limit);
}
