"use client";

import { useEffect } from "react";
import { initDeferredInstallCapture } from "@/lib/pwa-deferred-install";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

/** Client-only: service worker + native install capture (beforeinstallprompt). */
export function PwaClient() {
  useEffect(() => {
    initDeferredInstallCapture();
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }
  }, []);

  return <InstallPrompt />;
}
