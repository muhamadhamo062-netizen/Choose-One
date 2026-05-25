type FailureKind = "db_latency" | "queue_delay" | "event_loss" | "worker_slowdown";

function isEnabled(debugFailure?: boolean): boolean {
  if (process.env.NODE_ENV === "production" && !debugFailure) {
    return false;
  }
  return debugFailure || process.env.DEBUG_FAILURE_MODE === "true";
}

function configValue(kind: FailureKind): number {
  const key = `FAILURE_INJECT_${kind.toUpperCase()}`;
  const raw = Number(process.env[key] ?? "0");
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export async function injectFailure(kind: FailureKind, opts?: { debugFailure?: boolean }): Promise<{
  dropped: boolean;
}> {
  if (!isEnabled(opts?.debugFailure)) {
    return { dropped: false };
  }

  if (kind === "db_latency" || kind === "queue_delay" || kind === "worker_slowdown") {
    const delayMs = configValue(kind);
    if (delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
    return { dropped: false };
  }

  if (kind === "event_loss") {
    const lossPct = Math.min(100, configValue(kind));
    if (lossPct > 0 && Math.random() * 100 < lossPct) {
      return { dropped: true };
    }
  }
  return { dropped: false };
}
