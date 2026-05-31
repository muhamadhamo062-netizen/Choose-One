"use client";

import { useCallback, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import {
  getDeferredInstallPrompt,
  promptNativeInstall,
  waitForDeferredInstallPrompt
} from "@/lib/pwa-deferred-install";
import {
  isInAppBrowser,
  isLikelyIOS,
  isStandaloneMode,
  openInSystemBrowser,
  openIosInstallShareSheet
} from "@/lib/pwa-platform";

export function usePwaInstall() {
  const [busy, setBusy] = useState(false);

  const install = useCallback(async (surface: "banner" | "floating" | "header" | "auto") => {
    if (isStandaloneMode() || busy) {
      return false;
    }
    setBusy(true);
    trackEvent({ name: "install_clicked", surface });

    try {
      if (isInAppBrowser()) {
        openInSystemBrowser();
        return false;
      }

      if (isLikelyIOS()) {
        await openIosInstallShareSheet();
        return false;
      }

      const nativePrompt =
        getDeferredInstallPrompt() ?? (await waitForDeferredInstallPrompt(5000));
      if (nativePrompt) {
        const outcome = await promptNativeInstall(nativePrompt);
        if (outcome === "accepted") {
          trackEvent({ name: "install_completed" });
          return true;
        }
      }
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return { install, busy, canShow: !isStandaloneMode() };
}
