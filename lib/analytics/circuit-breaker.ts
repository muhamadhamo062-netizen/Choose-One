import { publishObservabilitySignal, setBreakerState } from "@/lib/analytics/observability-bus";
import { recordStateChange, shouldAllowTransition } from "@/lib/analytics/system-stability-governor";

type CircuitState = "closed" | "open" | "half_open";

type Breaker = {
  state: CircuitState;
  failures: number;
  openedAt: number;
  halfOpenTrial: boolean;
};

const breakers = new Map<string, Breaker>();

const FAILURE_THRESHOLD = 5;
const OPEN_MS = 30_000;

function now(): number {
  return Date.now();
}

function get(name: string): Breaker {
  const b = breakers.get(name);
  if (b) {
    return b;
  }
  const fresh: Breaker = { state: "closed", failures: 0, openedAt: 0, halfOpenTrial: false };
  breakers.set(name, fresh);
  return fresh;
}

export function circuitState(name: string): CircuitState {
  const b = get(name);
  if (b.state === "open" && now() - b.openedAt > OPEN_MS) {
    const next = `${name}:half_open`;
    if (shouldAllowTransition("circuit_breaker", next)) {
      b.state = "half_open";
      b.halfOpenTrial = false;
      recordStateChange("circuit_breaker", next);
      setBreakerState(name, b.state);
      publishObservabilitySignal({
        type: "circuit_half_open",
        severity: "warn",
        payload: { breaker: name }
      });
    }
  }
  return b.state;
}

export function allCircuitStates(): Record<string, CircuitState> {
  const out: Record<string, CircuitState> = {};
  for (const [k, v] of breakers.entries()) {
    out[k] = v.state;
  }
  return out;
}

export async function withCircuitBreaker<T>(
  name: string,
  task: () => Promise<T>,
  fallback: () => T | Promise<T>
): Promise<T> {
  const b = get(name);
  const st = circuitState(name);
  if (st === "open") {
    publishObservabilitySignal({
      type: "circuit_fast_fail",
      severity: "warn",
      payload: { breaker: name }
    });
    return fallback();
  }
  if (st === "half_open" && b.halfOpenTrial) {
    return fallback();
  }
  if (st === "half_open") {
    b.halfOpenTrial = true;
  }

  try {
    const out = await task();
    b.failures = 0;
    const next = `${name}:closed`;
    if (shouldAllowTransition("circuit_breaker", next)) {
      b.state = "closed";
      b.halfOpenTrial = false;
      recordStateChange("circuit_breaker", next);
      setBreakerState(name, b.state);
    }
    return out;
  } catch {
    b.failures += 1;
    if (b.failures >= FAILURE_THRESHOLD) {
      const next = `${name}:open`;
      if (shouldAllowTransition("circuit_breaker", next)) {
        b.state = "open";
        b.openedAt = now();
        b.halfOpenTrial = false;
        recordStateChange("circuit_breaker", next);
        setBreakerState(name, b.state);
        publishObservabilitySignal({
          type: "circuit_opened",
          severity: "error",
          payload: { breaker: name, failures: b.failures }
        });
      }
    }
    return fallback();
  }
}
