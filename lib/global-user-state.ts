import {
  STORAGE_DASH_PROTECTED,
  STORAGE_PAYWALL_INTERACTED,
  STORAGE_SIGNUP_PENDING,
  STORAGE_CHECKOUT_STARTED
} from "@/lib/growth-constants";
import { getPeScanData, getPeUser, getUserPlan } from "@/lib/scan-storage";
import { trackEvent } from "@/lib/analytics";

/** Full app funnel + outcome (computed from storage + domain rules). */
export enum UserState {
  FREE_SCAN = "FREE_SCAN",
  EXPOSED = "EXPOSED",
  PAYWALL_INTERACTED = "PAYWALL_INTERACTED",
  CHECKOUT_STARTED = "CHECKOUT_STARTED",
  SIGNUP_PENDING = "SIGNUP_PENDING",
  PAID = "PAID",
  PROTECTED = "PROTECTED"
}

export const PE_STATE_CHANGE = "pe_state_change";

export type PeStateChangeDetail = {
  state: UserState;
  previous: UserState;
  reason: string;
};

let lastEmitted: UserState = UserState.FREE_SCAN;

function isLifetime(): boolean {
  return getUserPlan() === "lifetime";
}

/**
 * Computed from storage. Priority: PROTECTED → PAID → SIGNUP (paid, no acct) →
 * CHECKOUT_STARTED → PAYWALL_INTERACTED → organic SIGNUP_PENDING → EXPOSED → FREE_SCAN.
 */
export function computeGlobalUserState(): UserState {
  if (typeof window === "undefined") {
    return UserState.FREE_SCAN;
  }

  const user = getPeUser();
  const scan = getPeScanData();
  const paywall = window.localStorage.getItem(STORAGE_PAYWALL_INTERACTED) === "1";
  const checkoutStarted = window.localStorage.getItem(STORAGE_CHECKOUT_STARTED) === "1";
  const signupPending = window.localStorage.getItem(STORAGE_SIGNUP_PENDING) === "1";
  const protectedFlag = window.localStorage.getItem(STORAGE_DASH_PROTECTED) === "1";

  if (isLifetime() && user) {
    if (protectedFlag) {
      return UserState.PROTECTED;
    }
    return UserState.PAID;
  }

  if (isLifetime() && !user) {
    return UserState.SIGNUP_PENDING;
  }

  if (checkoutStarted) {
    return UserState.CHECKOUT_STARTED;
  }

  if (paywall) {
    return UserState.PAYWALL_INTERACTED;
  }

  if (signupPending && !user) {
    return UserState.SIGNUP_PENDING;
  }

  if (scan) {
    return UserState.EXPOSED;
  }

  return UserState.FREE_SCAN;
}

function emit(detail: PeStateChangeDetail): void {
  if (typeof window === "undefined") {
    return;
  }
  if (detail.state !== detail.previous) {
    trackEvent({ name: "state_changed", state: detail.state, previous: detail.previous, reason: detail.reason });
    trackEvent({
      name: "funnel_stage_entered",
      stage: detail.state,
      previous: detail.previous,
      reason: detail.reason
    });
  }
  lastEmitted = detail.state;
  window.dispatchEvent(new CustomEvent(PE_STATE_CHANGE, { detail }));
}

/**
 * Recompute and emit when the value changed, or if `force` (e.g. re-scan to EXPOSED).
 */
export function pushGlobalStateChange(reason: string, force?: boolean): UserState {
  if (typeof window === "undefined") {
    return UserState.FREE_SCAN;
  }
  const state = computeGlobalUserState();
  const previous = lastEmitted;
  if (state !== previous || force) {
    emit({ state, previous, reason });
  } else {
    lastEmitted = state;
  }
  return state;
}

export function getLastEmittedState(): UserState {
  return lastEmitted;
}

export function primeGlobalState(): UserState {
  if (typeof window === "undefined") {
    return UserState.FREE_SCAN;
  }
  const s = computeGlobalUserState();
  lastEmitted = s;
  return s;
}

/**
 * Set funnel flags + broadcast. `pe_scan` / `pe_user` are written by their own modules.
 */
export function setUserState(
  next: UserState,
  reason: string,
  options?: { forceEvent?: boolean }
): UserState {
  if (typeof window === "undefined") {
    return UserState.FREE_SCAN;
  }
  try {
    switch (next) {
      case UserState.PAYWALL_INTERACTED:
        localStorage.setItem(STORAGE_PAYWALL_INTERACTED, "1");
        break;
      case UserState.CHECKOUT_STARTED:
        localStorage.setItem(STORAGE_CHECKOUT_STARTED, "1");
        break;
      case UserState.SIGNUP_PENDING:
        localStorage.setItem(STORAGE_SIGNUP_PENDING, "1");
        break;
      case UserState.PROTECTED:
        localStorage.setItem(STORAGE_DASH_PROTECTED, "1");
        break;
      case UserState.EXPOSED:
        // pe_scan_data must already be present
        break;
      default:
        break;
    }
  } catch {
    // ignore
  }
  const force = (options?.forceEvent ?? false) || next === UserState.EXPOSED;
  return pushGlobalStateChange(reason, force);
}

export function clearCheckoutStarted(reason: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_CHECKOUT_STARTED);
  } catch {
    // ignore
  }
  pushGlobalStateChange(`clear_checkout:${reason}`);
}

export function clearSignupPending(reason: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_SIGNUP_PENDING);
  } catch {
    // ignore
  }
  pushGlobalStateChange(`clear_signup_pending:${reason}`);
}

/** @deprecated alias — prefer `computeGlobalUserState` */
export function getUserState(): UserState {
  return computeGlobalUserState();
}

type StateListener = (state: UserState) => void;

export function subscribeToStateChanges(listener: StateListener): () => void {
  if (typeof window === "undefined") {
    return () => {
      // noop
    };
  }
  const onPe = (e: Event) => {
    const d = (e as CustomEvent<PeStateChangeDetail>).detail;
    if (d?.state !== undefined) {
      listener(d.state);
    } else {
      listener(computeGlobalUserState());
    }
  };
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith("pe_") || e.key === "pe_plan") {
      const s = computeGlobalUserState();
      lastEmitted = s;
      listener(s);
    }
  };
  window.addEventListener(PE_STATE_CHANGE, onPe);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PE_STATE_CHANGE, onPe);
    window.removeEventListener("storage", onStorage);
  };
}
