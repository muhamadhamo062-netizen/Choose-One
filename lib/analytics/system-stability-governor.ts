import { publishObservabilitySignal } from "@/lib/analytics/observability-bus";

type TransitionType = "system_mode" | "write_fence" | "circuit_breaker" | "healing" | "recovery";

type StateChange = {
  at: number;
  type: TransitionType;
  state: string;
};

type BlockedTransition = {
  at: string;
  type: TransitionType;
  state: string;
  reason: string;
};

const MAX_HISTORY = 200;
const ROLLING_WINDOW = 20;
const FLIP_WINDOW_SHORT_MS = 60_000;
const FLIP_WINDOW_LONG_MS = 5 * 60_000;
const MIN_TRANSITION_INTERVAL_MS = Math.max(
  30_000,
  Math.min(120_000, Number(process.env.ANALYTICS_MIN_TRANSITION_INTERVAL_MS ?? "45000"))
);
const LOCK_DURATION_MS = 90_000;

const changes: StateChange[] = [];
const blocked: BlockedTransition[] = [];
let lockUntil = 0;
let unstable = false;
let modeEnteredEmitted = false;
let rollbackTransitions = 0;
let driftSamples: number[] = [];

function nowMs(): number {
  return Date.now();
}

function addBlocked(type: TransitionType, state: string, reason: string): void {
  blocked.unshift({ at: new Date().toISOString(), type, state, reason });
  if (blocked.length > MAX_HISTORY) {
    blocked.length = MAX_HISTORY;
  }
  publishObservabilitySignal({
    type: "STABILITY_TRANSITION_BLOCKED",
    severity: "warn",
    payload: { transitionType: type, state, reason }
  });
}

function pushChange(change: StateChange): void {
  changes.unshift(change);
  if (changes.length > MAX_HISTORY) {
    changes.length = MAX_HISTORY;
  }
}

function countFlips(type: TransitionType, ms: number): number {
  const cutoff = nowMs() - ms;
  const scoped = changes.filter((c) => c.type === type && c.at >= cutoff).slice(0, ROLLING_WINDOW);
  let flips = 0;
  for (let i = 1; i < scoped.length; i += 1) {
    if (scoped[i - 1]!.state !== scoped[i]!.state) {
      flips += 1;
    }
  }
  return flips;
}

function isEmergency(type: TransitionType, state: string): boolean {
  if (type === "system_mode" && state === "locked") {
    return true;
  }
  if (type === "recovery") {
    return true;
  }
  if (type === "write_fence" && state === "EXCLUSIVE") {
    return true;
  }
  if (state.toLowerCase().includes("dlq")) {
    return true;
  }
  if (type === "circuit_breaker" && state.endsWith(":open")) {
    return true;
  }
  return false;
}

function evaluateStability(): void {
  const targets: TransitionType[] = ["system_mode", "write_fence", "circuit_breaker", "healing"];
  let shortFlipTriggered = false;
  let longFlipTriggered = false;
  for (const t of targets) {
    shortFlipTriggered = shortFlipTriggered || countFlips(t, FLIP_WINDOW_SHORT_MS) > 3;
    longFlipTriggered = longFlipTriggered || countFlips(t, FLIP_WINDOW_LONG_MS) > 5;
  }
  const wasUnstable = unstable;
  unstable = shortFlipTriggered || longFlipTriggered || nowMs() < lockUntil;
  if (longFlipTriggered) {
    lockUntil = Math.max(lockUntil, nowMs() + LOCK_DURATION_MS);
  }
  if (unstable && !wasUnstable && !modeEnteredEmitted) {
    modeEnteredEmitted = true;
    publishObservabilitySignal({
      type: "STABILITY_MODE_ENTERED",
      severity: "error",
      payload: { lockUntil: lockUntil > nowMs() ? new Date(lockUntil).toISOString() : null }
    });
  }
  if (!unstable) {
    modeEnteredEmitted = false;
  }
  if (shortFlipTriggered || longFlipTriggered) {
    publishObservabilitySignal({
      type: "STABILITY_OSCILLATION_DETECTED",
      severity: "warn",
      payload: { shortFlipTriggered, longFlipTriggered }
    });
  }
}

export function detectOscillation(metricName: string, value: number): { oscillating: boolean; metricName: string; value: number } {
  if (metricName === "drift_score") {
    driftSamples.unshift(value);
    if (driftSamples.length > 20) {
      driftSamples.length = 20;
    }
  }
  evaluateStability();
  return { oscillating: unstable, metricName, value };
}

export function shouldAllowTransition(type: TransitionType, newState: string): boolean {
  evaluateStability();
  const emergency = isEmergency(type, newState);
  if (emergency) {
    return true;
  }
  if (nowMs() < lockUntil) {
    addBlocked(type, newState, "stability_lock");
    return false;
  }
  const lastOfType = changes.find((c) => c.type === type);
  if (unstable && lastOfType && nowMs() - lastOfType.at < MIN_TRANSITION_INTERVAL_MS) {
    addBlocked(type, newState, "min_transition_interval");
    return false;
  }
  return true;
}

export function recordStateChange(type: TransitionType, state: string): void {
  pushChange({ at: nowMs(), type, state });
  if (type === "recovery") {
    rollbackTransitions += 1;
  }
  evaluateStability();
}

export function getStabilityScore(): {
  stabilityScore: number;
  oscillationDetected: boolean;
  blockedTransitions: BlockedTransition[];
  lastStateChanges: Array<{ at: string; type: TransitionType; state: string }>;
} {
  evaluateStability();
  const shortFlips =
    countFlips("system_mode", FLIP_WINDOW_SHORT_MS) +
    countFlips("write_fence", FLIP_WINDOW_SHORT_MS) +
    countFlips("circuit_breaker", FLIP_WINDOW_SHORT_MS) +
    countFlips("healing", FLIP_WINDOW_SHORT_MS);
  const longFlips =
    countFlips("system_mode", FLIP_WINDOW_LONG_MS) +
    countFlips("write_fence", FLIP_WINDOW_LONG_MS) +
    countFlips("circuit_breaker", FLIP_WINDOW_LONG_MS) +
    countFlips("healing", FLIP_WINDOW_LONG_MS);
  const driftVariancePenalty =
    driftSamples.length < 2
      ? 0
      : Math.min(
          20,
          Math.round(
            Math.abs(Math.max(...driftSamples) - Math.min(...driftSamples)) * 0.2
          )
        );
  const rollbackPenalty = Math.min(15, rollbackTransitions * 2);
  const blockPenalty = Math.min(20, blocked.length);
  const transitionPenalty = Math.min(45, shortFlips * 4 + longFlips * 2);
  const stabilityScore = Math.max(0, 100 - transitionPenalty - rollbackPenalty - driftVariancePenalty - blockPenalty);
  return {
    stabilityScore,
    oscillationDetected: unstable || nowMs() < lockUntil,
    blockedTransitions: blocked.slice(0, 50),
    lastStateChanges: changes.slice(0, 50).map((c) => ({
      at: new Date(c.at).toISOString(),
      type: c.type,
      state: c.state
    }))
  };
}
