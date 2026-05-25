import type { Scan, Subscription } from "@prisma/client";

export type ServerDashboardState = "NO_SCAN" | "EXPOSED" | "PROTECTED";

/**
 * - NO_SCAN: no scan on file (and not on a paid tier that hides exposure UI)
 * - EXPOSED: scan exists, no active paid entitlement
 * - PROTECTED: active paid entitlement (e.g. lifetime)
 */
export function computeServerDashboardState(
  scan: Scan | null,
  sub: Pick<Subscription, "plan" | "status"> | null
): ServerDashboardState {
  const plan = sub?.plan ?? "free";
  const active = sub?.status === "active";
  const paid = active && (plan === "lifetime" || plan === "monthly");
  if (paid) {
    return "PROTECTED";
  }
  if (!scan) {
    return "NO_SCAN";
  }
  return "EXPOSED";
}
