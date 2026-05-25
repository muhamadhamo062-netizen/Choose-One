import { UserState } from "@/lib/global-user-state";
import type { PeScanData, UserPlan } from "@/types/funnel";
import type { ServerStateGetResponse, ServerStateSnapshot } from "@/lib/server-state-types";

export function buildGetResponse(
  snapshot: ServerStateSnapshot | null,
  scan: PeScanData | null,
  source: ServerStateGetResponse["source"]
): ServerStateGetResponse {
  if (!snapshot) {
    return {
      userId: null,
      email: null,
      state: UserState.FREE_SCAN,
      plan: "free",
      scan: null,
      lastUpdated: new Date().toISOString(),
      source,
      flags: {
        paywallInteracted: false,
        checkoutStarted: false,
        signupPending: false,
        protected: false
      }
    };
  }

  return {
    userId: snapshot.userId,
    email: snapshot.email,
    state: snapshot.state,
    plan: snapshot.plan,
    scan,
    lastUpdated: snapshot.lastUpdated,
    source,
    flags: {
      paywallInteracted: snapshot.paywallInteracted,
      checkoutStarted: snapshot.checkoutStarted,
      signupPending: snapshot.signupPending,
      protected: snapshot.protected
    }
  };
}
