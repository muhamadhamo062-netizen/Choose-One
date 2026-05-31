"use client";

import { useEffect } from "react";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

/** Client-only: service worker registration + install prompts. */
export function PwaClient() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);

  return <InstallPrompt />;
}
