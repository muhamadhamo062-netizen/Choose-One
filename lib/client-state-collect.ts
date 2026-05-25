"use client";

import { computeGlobalUserState, UserState } from "@/lib/global-user-state";
import {
  STORAGE_CHECKOUT_STARTED,
  STORAGE_DASH_PROTECTED,
  STORAGE_PAYWALL_INTERACTED,
  STORAGE_PLAN,
  STORAGE_SIGNUP_PENDING
} from "@/lib/growth-constants";
import type { ClientSyncBody } from "@/lib/server-state-types";
import { getUserPlan } from "@/lib/scan-storage";
import type { UserPlan } from "@/types/funnel";

/**
 * Gathers the current local snapshot to POST to `/api/state/sync` (or merge on server).
 * User + scan authoritative data live on the server (`/api/user/session`); do not send stale localStorage copies.
 */
export function collectClientStateForSync(): ClientSyncBody {
  if (typeof window === "undefined") {
    return {
      user: null,
      plan: "free",
      scan: null,
      paywallInteracted: false,
      checkoutStarted: false,
      signupPending: false,
      protected: false,
      clientComputedState: UserState.FREE_SCAN
    };
  }
  const plan: UserPlan = getUserPlan();
  return {
    user: null,
    plan,
    scan: null,
    paywallInteracted: window.localStorage.getItem(STORAGE_PAYWALL_INTERACTED) === "1",
    checkoutStarted: window.localStorage.getItem(STORAGE_CHECKOUT_STARTED) === "1",
    signupPending: window.localStorage.getItem(STORAGE_SIGNUP_PENDING) === "1",
    protected: window.localStorage.getItem(STORAGE_DASH_PROTECTED) === "1",
    clientComputedState: computeGlobalUserState()
  };
}
