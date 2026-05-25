"use client";

import { collectClientStateForSync } from "@/lib/client-state-collect";
import { clientBodyToInput } from "@/lib/client-body-flags";
import { computeGlobalUserState, UserState } from "@/lib/global-user-state";
import { resolveUserState } from "@/lib/state-resolver";
import type { ServerStateGetResponse } from "@/lib/server-state-types";

let lastServerResponse: ServerStateGetResponse | null = null;

export function setLastServerState(r: ServerStateGetResponse | null): void {
  lastServerResponse = r;
  refreshStateAnalyticsContext();
}

export function getLastServerState(): ServerStateGetResponse | null {
  return lastServerResponse;
}

function toServerPartial(r: ServerStateGetResponse | null) {
  if (!r || r.source === "default") {
    return null;
  }
  return {
    v: 1 as const,
    userId: r.userId,
    email: r.email,
    state: r.state,
    plan: r.plan,
    paywallInteracted: r.flags.paywallInteracted,
    checkoutStarted: r.flags.checkoutStarted,
    signupPending: r.flags.signupPending,
    protected: r.flags.protected,
    lastUpdated: r.lastUpdated,
    hasScan: Boolean(r.scan)
  };
}

/** Recomputes resolved_state = f(server, client) for analytics. */
export function refreshStateAnalyticsContext(): void {
  if (typeof window === "undefined") {
    return;
  }
  const client = clientBodyToInput(collectClientStateForSync());
  const server = toServerPartial(lastServerResponse);
  const resolved = resolveUserState(server, client);
  const clientState = computeGlobalUserState();
  lastTriplet = {
    server_state: String(lastServerResponse?.state ?? "none"),
    client_state: clientState,
    resolved_state: resolved
  };
}

let lastTriplet: { server_state: string; client_state: UserState; resolved_state: UserState } | null = null;

export function getStateAnalyticsContext() {
  if (!lastTriplet) {
    refreshStateAnalyticsContext();
  }
  return (
    lastTriplet ?? {
      server_state: "none",
      client_state: UserState.FREE_SCAN,
      resolved_state: UserState.FREE_SCAN
    }
  );
}
