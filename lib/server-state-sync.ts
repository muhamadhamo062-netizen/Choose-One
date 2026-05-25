"use client";

import { setLastServerState, refreshStateAnalyticsContext } from "@/lib/analytics-state";
import { collectClientStateForSync } from "@/lib/client-state-collect";
import { pushGlobalStateChange } from "@/lib/global-user-state";
import {
  STORAGE_CHECKOUT_STARTED,
  STORAGE_DASH_PROTECTED,
  STORAGE_LEAD_EMAIL,
  STORAGE_PAYWALL_INTERACTED,
  STORAGE_SIGNUP_PENDING
} from "@/lib/growth-constants";
import type { ServerStateGetResponse } from "@/lib/server-state-types";
import { syncSessionFromServerAppliedScan } from "@/lib/scan-session";
import { clearPeUser, getPeUser, savePeScanData, savePeUser, setUserPlan } from "@/lib/scan-storage";

const API_GET = "/api/state/get";
const API_SYNC = "/api/state/sync";

export async function fetchServerState(): Promise<ServerStateGetResponse> {
  const res = await fetch(API_GET, { method: "GET", credentials: "include", cache: "no-store" });
  if (!res.ok) {
    throw new Error(`state_get_failed:${res.status}`);
  }
  const data = (await res.json()) as ServerStateGetResponse;
  setLastServerState(data);
  return data;
}

export async function syncClientStateToServer(): Promise<ServerStateGetResponse> {
  const body = collectClientStateForSync();
  const res = await fetch(API_SYNC, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`state_sync_failed:${res.status}`);
  }
  const data = (await res.json()) as ServerStateGetResponse;
  setLastServerState(data);
  applyServerResponseToClient(data);
  refreshStateAnalyticsContext();
  pushGlobalStateChange("server_sync_post", true);
  return data;
}

/**
 * Server wins: persist flags, user, and scan to local storage.
 */
export function applyServerResponseToClient(r: ServerStateGetResponse): void {
  if (typeof window === "undefined" || r.source === "default") {
    return;
  }

  setUserPlan(r.plan);

  if (r.flags.protected) {
    try {
      window.localStorage.setItem(STORAGE_DASH_PROTECTED, "1");
    } catch {
      // ignore
    }
  } else {
    try {
      window.localStorage.removeItem(STORAGE_DASH_PROTECTED);
    } catch {
      // ignore
    }
  }

  if (r.flags.paywallInteracted) {
    try {
      window.localStorage.setItem(STORAGE_PAYWALL_INTERACTED, "1");
    } catch {
      // ignore
    }
  } else {
    try {
      window.localStorage.removeItem(STORAGE_PAYWALL_INTERACTED);
    } catch {
      // ignore
    }
  }

  if (r.flags.checkoutStarted) {
    try {
      window.localStorage.setItem(STORAGE_CHECKOUT_STARTED, "1");
    } catch {
      // ignore
    }
  } else {
    try {
      window.localStorage.removeItem(STORAGE_CHECKOUT_STARTED);
    } catch {
      // ignore
    }
  }

  if (r.flags.signupPending) {
    try {
      window.localStorage.setItem(STORAGE_SIGNUP_PENDING, "1");
    } catch {
      // ignore
    }
  } else {
    try {
      window.localStorage.removeItem(STORAGE_SIGNUP_PENDING);
    } catch {
      // ignore
    }
  }

  if (r.email && r.userId) {
    const existing = getPeUser();
    savePeUser({
      fullName: r.email.split("@")[0] ?? "Member",
      email: r.email,
      createdAt: new Date().toISOString(),
      referralCode: existing?.referralCode,
      referredByCode: existing?.referredByCode
    });
    try {
      window.localStorage.setItem(STORAGE_LEAD_EMAIL, r.email);
    } catch {
      // ignore
    }
  } else {
    clearPeUser();
  }

  if (r.scan) {
    savePeScanData(r.scan);
    syncSessionFromServerAppliedScan(r.scan);
  }
}

/**
 * Fetches the server view; when a cookie/DB record exists, applies it over the client.
 */
export async function reconcileState(reason?: string): Promise<ServerStateGetResponse> {
  const s = await fetchServerState();
  if (s.source !== "default") {
    applyServerResponseToClient(s);
  }
  refreshStateAnalyticsContext();
  void reason;
  pushGlobalStateChange(`reconcile${reason ? `_${reason}` : ""}`, true);
  return s;
}
