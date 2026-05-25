import type { PeScanData, UserPlan } from "@/types/funnel";
import type { UserState } from "@/lib/global-user-state";

/** Authoritative user snapshot the server can persist (cookie / DB). */
export type ServerStateSnapshot = {
  v: 1;
  userId: string | null;
  email: string | null;
  state: UserState;
  plan: UserPlan;
  paywallInteracted: boolean;
  checkoutStarted: boolean;
  signupPending: boolean;
  protected: boolean;
  lastUpdated: string;
  /** Fingerprint: has scan in sync payload (body too large for cookie); GET fills from sync. */
  hasScan: boolean;
};

export type ServerStateFlags = {
  paywallInteracted: boolean;
  checkoutStarted: boolean;
  signupPending: boolean;
  protected: boolean;
};

export type ServerStateGetResponse = {
  userId: string | null;
  email: string | null;
  state: UserState;
  plan: UserPlan;
  scan: PeScanData | null;
  lastUpdated: string;
  /** Provenance: db | cookie | default */
  source: "db" | "cookie" | "default";
  flags: ServerStateFlags;
};

export type ClientSyncBody = {
  user: { fullName: string; email: string; createdAt: string } | null;
  plan: UserPlan;
  scan: PeScanData | null;
  paywallInteracted: boolean;
  checkoutStarted: boolean;
  signupPending: boolean;
  protected: boolean;
  clientComputedState: UserState;
};

export const COOKIE_STATE = "pe_state_v1";
export const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400;
