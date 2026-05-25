"use client";

import { useEffect } from "react";
import { captureAcquisitionSourceFromWindow, captureReferralCodeFromUrl } from "@/lib/acquisition-source";
import { reconcileScanStorageState } from "@/lib/scan-session";
import { reconcileState } from "@/lib/server-state-sync";

/**
 * Fetches server-state once per app load; keeps client storage aligned with cookies when present.
 */
export function StateBootstrap() {
  useEffect(() => {
    captureAcquisitionSourceFromWindow();
    captureReferralCodeFromUrl();
    reconcileScanStorageState();
    void reconcileState("app_bootstrap").then(() => {
      reconcileScanStorageState();
    });
  }, []);
  return null;
}
