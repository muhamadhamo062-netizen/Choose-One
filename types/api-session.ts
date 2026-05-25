import type { ServerDashboardState } from "@/lib/server/dashboard-state";

/** GET /api/user/session — server-authoritative dashboard payload */
export type UserSessionPayload = {
  user: { id: string; email: string; fullName: string | null };
  /** Server billing / entitlement; JSON key is UI-safe. */
  lifetimeEntitlement: { plan: string; status: string; startedAt: string } | null;
  scan: {
    scanId: string;
    exposureScore: number;
    brokersFound: number;
    state: string;
    riskLevel: string | null;
    brokerSourceNames: string[];
  } | null;
  dashboardState: ServerDashboardState;
  /** Lifetime manual deep scans left this billing cycle (null when not on active lifetime). */
  scansRemaining: { used: number; limit: number; remaining: number; cycleStart: string } | null;
  removalJobs: Array<{
    id: string;
    brokerName: string;
    status: "pending" | "sent" | "verified" | "failed";
    requestChannel: "api" | "email";
    updatedAt: string;
    requestedAt: string | null;
    verifiedAt: string | null;
    lastError: string | null;
  }>;
  /** What the server actually persists; "none" = not implemented (UI must not invent status). */
  dataProvenance: {
    perBrokerRemovalStatus: "database";
    monitoringSchedule: "scheduled";
  };
};
