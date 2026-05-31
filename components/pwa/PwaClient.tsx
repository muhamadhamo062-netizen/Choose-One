"use client";

import { useEffect } from "react";
import { initDeferredInstallCapture } from "@/lib/pwa-deferred-install";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

/** Client-only: sync native install capture (SW is registered by @ducanh2912/next-pwa in production). */
export function PwaClient() {
  useEffect(() => {
    initDeferredInstallCapture();
  }, []);

  return <InstallPrompt />;
}
