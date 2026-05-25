"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getLastServerState,
  getStateAnalyticsContext,
  refreshStateAnalyticsContext
} from "@/lib/analytics-state";
import {
  computeGlobalUserState,
  primeGlobalState,
  setUserState as setFunnelUserState,
  subscribeToStateChanges,
  UserState
} from "@/lib/global-user-state";
import { reconcileState, syncClientStateToServer } from "@/lib/server-state-sync";

export {
  clearCheckoutStarted,
  clearSignupPending,
  getUserState,
  pushGlobalStateChange,
  subscribeToStateChanges,
  setUserState,
  UserState
} from "@/lib/global-user-state";

/**
 * Subscribes to local `pe_state_change` and refreshes server triplet. Use after `StateBootstrap` runs.
 */
export function useServerState(): {
  serverState: ReturnType<typeof getLastServerState>;
  resolvedState: UserState;
  resync: () => Promise<unknown>;
  syncToServer: () => ReturnType<typeof syncClientStateToServer>;
} {
  const [, setTick] = useState(0);
  useEffect(() => {
    return subscribeToStateChanges(() => {
      refreshStateAnalyticsContext();
      setTick((n) => n + 1);
    });
  }, []);
  const serverState = getLastServerState();
  const resolvedState = getStateAnalyticsContext().resolved_state;
  const resync = useCallback(() => reconcileState("useServerState"), []);
  const syncToServer = useCallback(() => syncClientStateToServer(), []);
  return { serverState, resolvedState, resync, syncToServer };
}

/**
 * Local reactive funnel + triplet for analytics (server-informed after sync).
 */
export function useGlobalUserState(): {
  state: UserState;
  clientState: UserState;
  resolvedState: UserState;
  serverState: ReturnType<typeof getLastServerState>;
  refresh: () => UserState;
  resync: () => Promise<unknown>;
  syncToServer: () => ReturnType<typeof syncClientStateToServer>;
  setUserState: typeof setFunnelUserState;
} {
  const { serverState, resolvedState, resync, syncToServer } = useServerState();
  const [state, setState] = useState<UserState>(UserState.FREE_SCAN);

  useEffect(() => {
    setState(primeGlobalState());
  }, []);

  useEffect(() => {
    setState(computeGlobalUserState());
    return subscribeToStateChanges((s) => setState(s));
  }, []);

  const refresh = useCallback(() => {
    const s = computeGlobalUserState();
    setState(s);
    refreshStateAnalyticsContext();
    return s;
  }, []);

  return {
    state,
    clientState: state,
    resolvedState,
    serverState,
    refresh,
    resync,
    syncToServer,
    setUserState: setFunnelUserState
  };
}
