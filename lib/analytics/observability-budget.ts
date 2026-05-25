type SignalCategory = "STABILITY" | "FENCE" | "CIRCUIT" | "HEALING" | "REPLAY" | "OTHER";

type BudgetWindow = {
  startedAt: number;
  usage: Record<string, number>;
  suppressed: Record<string, number>;
  compressed: Record<string, number>;
  allowed: Record<string, number>;
};

const WINDOW_MS = 60_000;
const LIMITS: Record<SignalCategory, number> = {
  STABILITY: 5,
  FENCE: 10,
  CIRCUIT: 10,
  HEALING: 8,
  REPLAY: 5,
  OTHER: 30
};

const windowState: BudgetWindow = {
  startedAt: Date.now(),
  usage: {},
  suppressed: {},
  compressed: {},
  allowed: {}
};

function categoryForType(type: string): SignalCategory {
  const upper = type.toUpperCase();
  if (upper.startsWith("STABILITY_")) {
    return "STABILITY";
  }
  if (upper.includes("FENCE")) {
    return "FENCE";
  }
  if (upper.startsWith("CIRCUIT_")) {
    return "CIRCUIT";
  }
  if (upper.startsWith("AUTO_HEALING") || upper.startsWith("HEALING_")) {
    return "HEALING";
  }
  if (upper.startsWith("REPLAY_") || upper.startsWith("SNAPSHOT_")) {
    return "REPLAY";
  }
  return "OTHER";
}

function ensureWindow(): void {
  if (Date.now() - windowState.startedAt < WINDOW_MS) {
    return;
  }
  resetBudgetWindow();
}

export function resetBudgetWindow(): void {
  windowState.startedAt = Date.now();
  windowState.usage = {};
  windowState.suppressed = {};
  windowState.compressed = {};
  windowState.allowed = {};
}

export function trackSignal(type: string): void {
  ensureWindow();
  windowState.usage[type] = (windowState.usage[type] ?? 0) + 1;
}

export function canEmit(type: string): boolean {
  ensureWindow();
  const category = categoryForType(type);
  const limit = LIMITS[category];
  const used = windowState.usage[type] ?? 0;
  return used < limit;
}

export function getRemainingBudget(type: string): number {
  ensureWindow();
  const category = categoryForType(type);
  const limit = LIMITS[category];
  const used = windowState.usage[type] ?? 0;
  return Math.max(0, limit - used);
}

export function recordSuppressed(type: string): void {
  ensureWindow();
  windowState.suppressed[type] = (windowState.suppressed[type] ?? 0) + 1;
}

export function recordCompressed(type: string): void {
  ensureWindow();
  windowState.compressed[type] = (windowState.compressed[type] ?? 0) + 1;
}

export function recordAllowed(type: string): void {
  ensureWindow();
  windowState.allowed[type] = (windowState.allowed[type] ?? 0) + 1;
}

export function getBudgetSnapshot(): {
  windowStartedAt: string;
  windowSeconds: number;
  usage: Record<string, number>;
  suppressed: Record<string, number>;
  compressed: Record<string, number>;
  allowed: Record<string, number>;
  remainingBudget: Record<string, number>;
  totals: {
    emitted: number;
    suppressed: number;
    compressed: number;
    signalDropRate: number;
    budgetPressureScore: number;
  };
} {
  ensureWindow();
  const allTypes = new Set([
    ...Object.keys(windowState.usage),
    ...Object.keys(windowState.suppressed),
    ...Object.keys(windowState.allowed)
  ]);
  const remainingBudget: Record<string, number> = {};
  for (const t of allTypes) {
    remainingBudget[t] = getRemainingBudget(t);
  }
  const emitted = Object.values(windowState.allowed).reduce((a, b) => a + b, 0);
  const suppressed = Object.values(windowState.suppressed).reduce((a, b) => a + b, 0);
  const compressed = Object.values(windowState.compressed).reduce((a, b) => a + b, 0);
  const totalAttempts = emitted + suppressed;
  const signalDropRate = totalAttempts > 0 ? Number(((suppressed / totalAttempts) * 100).toFixed(2)) : 0;
  const budgetPressureScore = Math.max(0, Math.min(100, Math.round(signalDropRate + compressed * 2)));
  return {
    windowStartedAt: new Date(windowState.startedAt).toISOString(),
    windowSeconds: Math.floor(WINDOW_MS / 1000),
    usage: { ...windowState.usage },
    suppressed: { ...windowState.suppressed },
    compressed: { ...windowState.compressed },
    allowed: { ...windowState.allowed },
    remainingBudget,
    totals: {
      emitted,
      suppressed,
      compressed,
      signalDropRate,
      budgetPressureScore
    }
  };
}
