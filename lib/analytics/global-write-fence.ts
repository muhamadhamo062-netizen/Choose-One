import { prisma } from "@/lib/prisma";
import { safeDbResult } from "@/lib/safe-db";
import { publishObservabilitySignal, setWriteFenceState } from "@/lib/analytics/observability-bus";
import { recordStateChange, shouldAllowTransition } from "@/lib/analytics/system-stability-governor";

export type WriteFenceState = "NONE" | "ACTIVE" | "EXCLUSIVE";
type FenceContext = "api" | "worker" | "replay" | "healing";

type FenceRecord = {
  fenceId: string;
  state: WriteFenceState;
  reason: string;
  acquiredAt: string;
  expiresAt: string;
};

const DB_KEY = "global_write_fence";
const DEFAULT_TTL_MS = 60_000;
let currentFence: FenceRecord | null = null;
let initialized = false;
let healthyCycles = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function isExpired(fence: FenceRecord): boolean {
  return Date.now() > new Date(fence.expiresAt).getTime();
}

function nextFenceId(): string {
  return `fence_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function persistFenceState(): Promise<void> {
  await safeDbResult(() =>
    prisma.analyticsSystemState.upsert({
      where: { key: DB_KEY },
      create: {
        key: DB_KEY,
        value: {
          fence: currentFence,
          healthyCycles
        }
      },
      update: {
        value: {
          fence: currentFence,
          healthyCycles
        }
      }
    })
  );
}

async function ensureInitialized(): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;
  const initRes = await safeDbResult(() => prisma.analyticsSystemState.findUnique({ where: { key: DB_KEY } }));
  if (initRes.ok) {
    const row = initRes.value;
    const value = (row?.value ?? {}) as { fence?: FenceRecord | null; healthyCycles?: number };
    currentFence = value.fence ?? null;
    healthyCycles = Number.isFinite(value.healthyCycles) ? Number(value.healthyCycles) : 0;
    if (currentFence && isExpired(currentFence)) {
      currentFence = null;
      healthyCycles = 0;
      await persistFenceState();
    }
  }
  setWriteFenceState(currentFence);
}

function replayAllowedDuringExclusive(): boolean {
  const v = (process.env.ANALYTICS_FENCE_REPLAY_ENABLED ?? "true").toLowerCase();
  return v !== "false";
}

export async function acquireFence(
  reason: string,
  ttlMs = DEFAULT_TTL_MS,
  opts?: { state?: Exclude<WriteFenceState, "NONE"> }
): Promise<{ ok: true; fence: FenceRecord }> {
  await ensureInitialized();
  const state = opts?.state ?? "ACTIVE";
  const allow = shouldAllowTransition("write_fence", state);
  if (!allow) {
    const existing = currentFence && !isExpired(currentFence)
      ? currentFence
      : {
          fenceId: "none",
          state: "NONE" as WriteFenceState,
          reason: "transition_blocked",
          acquiredAt: nowIso(),
          expiresAt: nowIso()
        };
    return { ok: true, fence: existing };
  }
  const safeTtl = Math.max(1_000, Math.floor(ttlMs));
  const active = currentFence && !isExpired(currentFence) ? currentFence : null;
  if (active && active.reason === reason && active.state === state) {
    const extended: FenceRecord = {
      ...active,
      expiresAt: new Date(Date.now() + safeTtl).toISOString()
    };
    currentFence = extended;
    setWriteFenceState(currentFence);
    await persistFenceState();
    return { ok: true, fence: extended };
  }

  const fence: FenceRecord = {
    fenceId: nextFenceId(),
    state,
    reason,
    acquiredAt: nowIso(),
    expiresAt: new Date(Date.now() + safeTtl).toISOString()
  };
  currentFence = fence;
  healthyCycles = 0;
  recordStateChange("write_fence", fence.state);
  setWriteFenceState(currentFence);
  await persistFenceState();
  publishObservabilitySignal({
    type: "WRITE_FENCE_ACQUIRED",
    severity: "warn",
    payload: {
      fenceId: fence.fenceId,
      state: fence.state,
      reason: fence.reason,
      expiresAt: fence.expiresAt
    }
  });
  return { ok: true, fence };
}

export async function releaseFence(fenceId: string): Promise<{ ok: true; released: boolean }> {
  await ensureInitialized();
  if (!currentFence || currentFence.fenceId !== fenceId) {
    return { ok: true, released: false };
  }
  const allow = shouldAllowTransition("write_fence", "NONE");
  if (!allow) {
    return { ok: true, released: false };
  }
  const prev = currentFence;
  currentFence = null;
  healthyCycles = 0;
  recordStateChange("write_fence", "NONE");
  setWriteFenceState(null);
  await persistFenceState();
  publishObservabilitySignal({
    type: "WRITE_FENCE_RELEASED",
    severity: "info",
    payload: { fenceId: prev.fenceId, reason: prev.reason, state: prev.state }
  });
  return { ok: true, released: true };
}

export async function getFenceState(): Promise<{
  state: WriteFenceState;
  fence: FenceRecord | null;
  healthyCycles: number;
}> {
  await ensureInitialized();
  if (currentFence && isExpired(currentFence)) {
    const expired = currentFence;
    currentFence = null;
    healthyCycles = 0;
    setWriteFenceState(null);
    await persistFenceState();
    publishObservabilitySignal({
      type: "WRITE_FENCE_RELEASED",
      severity: "info",
      payload: { fenceId: expired.fenceId, reason: "ttl_expired", state: expired.state }
    });
  }
  return {
    state: currentFence?.state ?? "NONE",
    fence: currentFence,
    healthyCycles
  };
}

export async function isWriteAllowed(context: FenceContext): Promise<boolean> {
  const state = await getFenceState();
  const fenceState = state.state;
  let allowed = true;
  if (fenceState === "ACTIVE") {
    allowed = context === "replay";
  } else if (fenceState === "EXCLUSIVE") {
    allowed = context === "replay" && replayAllowedDuringExclusive();
  }
  if (!allowed) {
    publishObservabilitySignal({
      type: "WRITE_BLOCKED_ATTEMPT",
      severity: "warn",
      payload: { context, fenceState, fenceId: state.fence?.fenceId ?? null }
    });
  }
  return allowed;
}

export async function handleSystemModeFence(mode: "normal" | "read_only" | "degraded" | "locked"): Promise<void> {
  if (mode === "locked") {
    await acquireFence("system_mode_locked", 5 * 60_000, { state: "EXCLUSIVE" });
    return;
  }
  if (mode === "normal") {
    const state = await getFenceState();
    if (state.fence?.reason === "system_mode_locked") {
      await releaseFence(state.fence.fenceId);
    }
  }
}

export async function reportDriftScore(driftScore: number): Promise<void> {
  if (driftScore >= 80) {
    await acquireFence(`critical_drift_${driftScore}`, 5 * 60_000, { state: "ACTIVE" });
  }
}

export async function reportHealthScore(healthScore: number): Promise<void> {
  const state = await getFenceState();
  if (state.state === "NONE") {
    healthyCycles = 0;
    return;
  }
  if (healthScore > 90) {
    healthyCycles += 1;
    await persistFenceState();
    if (healthyCycles >= 3 && state.fence) {
      await releaseFence(state.fence.fenceId);
    }
    return;
  }
  healthyCycles = 0;
  await persistFenceState();
}
