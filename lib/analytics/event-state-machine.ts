export const ANALYTICS_LIFECYCLE_FLOW = [
  "scan_created",
  "scan_completed",
  "discovery_found",
  "verification_started",
  "verification_completed"
] as const;

export const ANALYTICS_TERMINAL_EVENTS = [
  "verified_deleted",
  "partial_deleted",
  "not_confirmed"
] as const;

export type AnalyticsLifecycleEvent = (typeof ANALYTICS_LIFECYCLE_FLOW)[number] | (typeof ANALYTICS_TERMINAL_EVENTS)[number];

const STEP_INDEX: Record<AnalyticsLifecycleEvent, number> = {
  scan_created: 0,
  scan_completed: 1,
  discovery_found: 2,
  verification_started: 3,
  verification_completed: 4,
  verified_deleted: 5,
  partial_deleted: 5,
  not_confirmed: 5
};

export function isLifecycleEvent(type: string): type is AnalyticsLifecycleEvent {
  return (ANALYTICS_LIFECYCLE_FLOW as readonly string[]).includes(type) || (ANALYTICS_TERMINAL_EVENTS as readonly string[]).includes(type);
}

export function validateLifecycleTransition(
  previous: AnalyticsLifecycleEvent | null,
  next: AnalyticsLifecycleEvent
): { ok: true } | { ok: false; reason: "invalid_sequence" } {
  if (!previous) {
    return next === "scan_created" ? { ok: true } : { ok: false, reason: "invalid_sequence" };
  }

  if ((ANALYTICS_TERMINAL_EVENTS as readonly string[]).includes(previous)) {
    return { ok: false, reason: "invalid_sequence" };
  }

  if (STEP_INDEX[next] <= STEP_INDEX[previous]) {
    return { ok: false, reason: "invalid_sequence" };
  }

  if (next === "verified_deleted" || next === "partial_deleted" || next === "not_confirmed") {
    return previous === "verification_completed" ? { ok: true } : { ok: false, reason: "invalid_sequence" };
  }

  return STEP_INDEX[next] === STEP_INDEX[previous] + 1 ? { ok: true } : { ok: false, reason: "invalid_sequence" };
}
