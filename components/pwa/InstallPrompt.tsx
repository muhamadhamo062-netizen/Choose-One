"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useUnlockModal } from "@/hooks/useUnlockModal";
import { trackEvent } from "@/lib/analytics";
import { subscribeDeferredInstallPrompt } from "@/lib/pwa-deferred-install";
import { PWA_EVENT_SCAN_COMPLETE } from "@/lib/pwa-install-events";
import { isInAppBrowser, isLikelyIOS, isStandaloneMode } from "@/lib/pwa-platform";
import { usePwaInstall } from "@/lib/use-pwa-install";
import { cn } from "@/lib/utils";

const BANNER_DISMISS_KEY = "pe_pwa_install_banner_dismissed_v3";
const FLOAT_DISMISS_KEY = "pe_pwa_install_float_dismissed_v3";
const AUTO_PROMPT_SESSION_KEY = "pe_pwa_auto_prompt_done_v2";

export function InstallPrompt() {
  const { isOpen: paywallOpen } = useUnlockModal();
  const { install, busy } = usePwaInstall();

  const [deferredReady, setDeferredReady] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [floatDismissed, setFloatDismissed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const autoPrompted = useRef(false);

  useEffect(() => {
    return subscribeDeferredInstallPrompt((event) => {
      setDeferredReady(Boolean(event));
    });
  }, []);

  useEffect(() => {
    if (isStandaloneMode()) {
      return;
    }
    try {
      if (sessionStorage.getItem(BANNER_DISMISS_KEY) === "1") {
        setBannerDismissed(true);
      }
      if (sessionStorage.getItem(FLOAT_DISMISS_KEY) === "1") {
        setFloatDismissed(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /** Android: when native install becomes available, open system dialog once (Confirm = installed). */
  useEffect(() => {
    if (
      !deferredReady ||
      paywallOpen ||
      isStandaloneMode() ||
      isLikelyIOS() ||
      isInAppBrowser() ||
      autoPrompted.current
    ) {
      return;
    }
    try {
      if (sessionStorage.getItem(AUTO_PROMPT_SESSION_KEY) === "1") {
        return;
      }
      sessionStorage.setItem(AUTO_PROMPT_SESSION_KEY, "1");
    } catch {
      // ignore
    }
    autoPrompted.current = true;
    const t = window.setTimeout(() => {
      void install("auto");
    }, 900);
    return () => window.clearTimeout(t);
  }, [deferredReady, paywallOpen, install]);

  useEffect(() => {
    if (isStandaloneMode()) {
      return;
    }
    const onScan = () => {
      if (!isLikelyIOS() && !isInAppBrowser()) {
        void install("auto");
      }
    };
    window.addEventListener(PWA_EVENT_SCAN_COMPLETE, onScan);
    return () => window.removeEventListener(PWA_EVENT_SCAN_COMPLETE, onScan);
  }, [install]);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    trackEvent({ name: "install_dismissed", surface: "banner" });
    try {
      sessionStorage.setItem(BANNER_DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  const dismissFloat = useCallback(() => {
    setFloatDismissed(true);
    trackEvent({ name: "install_dismissed", surface: "floating" });
    try {
      sessionStorage.setItem(FLOAT_DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  const showUi = !isStandaloneMode() && !paywallOpen;
  const showBanner = showUi && !bannerDismissed && isMobile;
  const showFloat = showUi && !floatDismissed && isMobile;

  if (!showUi) {
    return null;
  }

  const installLabel = busy ? "Installing…" : "Install App";

  return (
    <>
      {showBanner && (
        <div
          className={cn(
            "fixed bottom-0 left-0 right-0 z-[100] border-t border-slate-800/80 bg-slate-950/95",
            "px-4 py-3 shadow-lg backdrop-blur",
            "supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          )}
          role="region"
          aria-label="Install app"
        >
          <div className="mx-auto flex max-w-2xl flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-slate-200 sm:flex-1">
              Install PrivacyEraser.ai on your phone — one tap, works like a native app
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                className="px-4 py-2 text-sm"
                disabled={busy}
                aria-busy={busy}
                onClick={() => void install("banner")}
              >
                {installLabel}
              </Button>
              <Button type="button" variant="outline" className="px-4 py-2 text-sm" onClick={dismissBanner}>
                Not now
              </Button>
            </div>
          </div>
        </div>
      )}

      {showFloat && (
        <div
          className={cn(
            "fixed z-[99] flex md:hidden",
            showBanner ? "bottom-28 right-4" : "bottom-6 right-4",
            "supports-[padding:max(0px)]:[bottom:max(1.5rem,env(safe-area-inset-bottom))]"
          )}
        >
          <div
            className={cn(
              "flex max-w-[13rem] items-stretch overflow-hidden rounded-2xl border border-slate-700/90",
              "bg-slate-900/95 shadow-xl backdrop-blur"
            )}
          >
            <button
              type="button"
              disabled={busy}
              onClick={() => void install("floating")}
              className="group flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-3 pr-1 text-left transition hover:bg-slate-800/90 disabled:opacity-60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Download className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 pr-1 text-xs font-semibold leading-tight text-white">{installLabel}</span>
            </button>
            <button
              type="button"
              onClick={dismissFloat}
              className="flex shrink-0 items-center border-l border-slate-800 px-2 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
              aria-label="Dismiss install"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
