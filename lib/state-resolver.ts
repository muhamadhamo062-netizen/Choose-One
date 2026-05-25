import { UserState } from "@/lib/global-user-state";
import type { UserPlan } from "@/types/funnel";
import type { ServerStateSnapshot } from "@/lib/server-state-types";

export type ResolvableStateInput = {
  plan: UserPlan;
  hasScan: boolean;
  paywallInteracted: boolean;
  checkoutStarted: boolean;
  signupPending: boolean;
  protected: boolean;
  hasUser: boolean;
};

/**
 * Single canonical `UserState` from merged flags (same priority as `computeGlobalUserState`).
 */
export function stateFromFlags(f: ResolvableStateInput): UserState {
  const { plan, hasUser, hasScan, protected: prot, checkoutStarted, paywallInteracted, signupPending } = f;

  if (plan === "lifetime" && hasUser) {
    if (prot) {
      return UserState.PROTECTED;
    }
    return UserState.PAID;
  }

  if (plan === "lifetime" && !hasUser) {
    return UserState.SIGNUP_PENDING;
  }

  if (checkoutStarted) {
    return UserState.CHECKOUT_STARTED;
  }

  if (paywallInteracted) {
    return UserState.PAYWALL_INTERACTED;
  }

  if (signupPending && !hasUser) {
    return UserState.SIGNUP_PENDING;
  }

  if (hasScan) {
    return UserState.EXPOSED;
  }

  return UserState.FREE_SCAN;
}

/**
 * Server fields override client on conflict. Paywall and checkout flags OR-merge so server-stored
 * paywall intent is preserved until superseded.
 */
export function mergeStateInputs(
  server: Partial<ServerStateSnapshot> | null,
  client: ResolvableStateInput
): ResolvableStateInput {
  if (!server) {
    return client;
  }
  const hasUser = Boolean(server.userId) || Boolean(server.email) || client.hasUser;
  return {
    plan: server.plan !== undefined && server.plan !== null ? server.plan : client.plan,
    hasUser,
    hasScan: server.hasScan !== undefined && server.hasScan !== null ? server.hasScan : client.hasScan,
    paywallInteracted: Boolean(server.paywallInteracted) || client.paywallInteracted,
    checkoutStarted: Boolean(server.checkoutStarted) || client.checkoutStarted,
    signupPending: Boolean(server.signupPending) || client.signupPending,
    protected: Boolean(server.protected) || client.protected
  };
}

/**
 * Final canonical `UserState` for analytics and UI. Server snapshot wins on identity/plan;
 * `mergeStateInputs` encodes the priority rules, then we derive state from flags.
 * PAID/PROTECTED (lifetime) always dominate via `stateFromFlags` ordering.
 */
export function resolveUserState(
  server: Partial<ServerStateSnapshot> | null,
  client: ResolvableStateInput
): UserState {
  return stateFromFlags(mergeStateInputs(server, client));
}
