"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useUnlockModal } from "@/hooks/useUnlockModal";
import { trackEvent } from "@/lib/analytics";
import {
  getDeferredInstallPrompt,
  promptNativeInstall,
  subscribeDeferredInstallPrompt,
  type BeforeInstallPromptEvent
} from "@/lib/pwa-deferred-install";
import { PWA_EVENT_PAYWALL_VIEWED, PWA_EVENT_SCAN_COMPLETE } from "@/lib/pwa-install-events";
import {
  isInAppBrowser,
  isLikelyIOS,
  isStandaloneMode,
  openInSystemBrowser,
  openIosInstallShareSheet
} from "@/lib/pwa-platform";
import { cn } from "@/lib/utils";

const BANNER_DISMISS_KEY = "pe_pwa_install_banner_dismissed_v2";
const FLOAT_DISMISS_KEY = "pe_pwa_install_float_dismissed_v2";
const AUTO_PROMPT_SESSION_KEY = "pe_pwa_auto_prompt_done_v1";

export function InstallPrompt() {
  const { isOpen: paywallOpen } = useUnlockModal();

  const [scanDone, setScanDone] = useState(false);
  const [postScanIdleReady, setPostScanIdleReady] = useState(false);
  const [paywallClosed, setPaywallClosed] = useState(false);
  const [paywallViewed, setPaywallViewed] = useState(false);
  const [engagement15s, setEngagement15s] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installBusy, setInstallBusy] = useState(false);

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [floatDismissed, setFloatDismissed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const installCompletedFired = useRef(false);
  const shownBanner = useRef(false);
  const shownFloat = useRef(false);
  const paywallEverOpened = useRef(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    deferredRef.current = deferred;
  }, [deferred]);

  useEffect(() => {
    return subscribeDeferredInstallPrompt((event) => {
      setDeferred(event);
    });
  }, []);

  useEffect(() => {
    if (isStandaloneMode()) {
      return;
    }
    const t = window.setTimeout(() => setEngagement15s(true), 15_000);
    return () => clearTimeout(t);
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
    if (paywallOpen) {
      paywallEverOpened.current = true;
      return;
    }
    if (paywallEverOpened.current) {
      setPaywallClosed(true);
    }
  }, [paywallOpen]);

  useEffect(() => {
    if (isStandaloneMode() || !scanDone) {
      return;
    }
    setPostScanIdleReady(false);
    const t = window.setTimeout(() => setPostScanIdleReady(true), 12_000);
    return () => clearTimeout(t);
  }, [scanDone]);

  useEffect(() => {
    if (isStandaloneMode()) {
      return;
    }
    const onScan = () => setScanDone(true);
    const onPaywall = () => setPaywallViewed(true);
    window.addEventListener(PWA_EVENT_SCAN_COMPLETE, onScan);
    window.addEventListener(PWA_EVENT_PAYWALL_VIEWED, onPaywall);
    return () => {
      window.removeEventListener(PWA_EVENT_SCAN_COMPLETE, onScan);
      window.removeEventListener(PWA_EVENT_PAYWALL_VIEWED, onPaywall);
    };
  }, []);

  useEffect(() => {
    if (isStandaloneMode()) {
      return;
    }
    const onInstalled = () => {
      if (installCompletedFired.current) {
        return;
      }
      installCompletedFired.current = true;
      trackEvent({ name: "install_completed" });
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const runOneTapInstall = useCallback(
    async (surface: "banner" | "floating" | "auto_post_scan") => {
      if (isStandaloneMode() || installBusy) {
        return;
      }
      setInstallBusy(true);
      trackEvent({ name: "install_clicked", surface });

      try {
        if (isInAppBrowser()) {
          openInSystemBrowser();
          return;
        }

        const nativePrompt = deferredRef.current ?? getDeferredInstallPrompt();
        if (nativePrompt) {
          const outcome = await promptNativeInstall(nativePrompt);
          if (outcome === "accepted" && !installCompletedFired.current) {
            installCompletedFired.current = true;
            trackEvent({ name: "install_completed" });
          }
          setDeferred(null);
          return;
        }

        if (isLikelyIOS()) {
          await openIosInstallShareSheet();
          return;
        }

        // Android/desktop: wait briefly for beforeinstallprompt (SW may still be registering).
        for (const delay of [0, 400, 900]) {
          if (delay > 0) {
            await new Promise((r) => window.setTimeout(r, delay));
          }
          const late = deferredRef.current ?? getDeferredInstallPrompt();
          if (late) {
            const outcome = await promptNativeInstall(late);
            if (outcome === "accepted" && !installCompletedFired.current) {
              installCompletedFired.current = true;
              trackEvent({ name: "install_completed" });
            }
            setDeferred(null);
            return;
          }
        }
      } finally {
        setInstallBusy(false);
      }
    },
    [installBusy]
  );

  const installEligible =
    scanDone || postScanIdleReady || paywallClosed || paywallViewed || engagement15s;

  /** After scan: auto-open native install on Android when the browser is ready (one tap to confirm). */
  useEffect(() => {
    if (!scanDone || paywallOpen || isStandaloneMode() || isLikelyIOS() || isInAppBrowser()) {
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      try {
        if (sessionStorage.getItem(AUTO_PROMPT_SESSION_KEY) === "1") {
          return;
        }
      } catch {
        return;
      }
      const nativePrompt = deferredRef.current ?? getDeferredInstallPrompt();
      if (!nativePrompt) {
        return;
      }
      try {
        sessionStorage.setItem(AUTO_PROMPT_SESSION_KEY, "1");
      } catch {
        // ignore
      }
      void runOneTapInstall("auto_post_scan");
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [scanDone, paywallOpen, deferred, runOneTapInstall]);

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

  const showBanner = !isStandaloneMode() && !paywallOpen && !bannerDismissed && installEligible;
  const showFloat =
    !isStandaloneMode() && !paywallOpen && !floatDismissed && isMobile && (scanDone || installEligible);

  useEffect(() => {
    if (showBanner && !shownBanner.current) {
      shownBanner.current = true;
      trackEvent({ name: "install_prompt_shown", surface: "banner" });
    }
  }, [showBanner]);

  useEffect(() => {
    if (showFloat && !shownFloat.current) {
      shownFloat.current = true;
      trackEvent({ name: "install_prompt_shown", surface: "floating" });
    }
  }, [showFloat]);

  if (isStandaloneMode()) {
    return null;
  }

  const installLabel = installBusy ? "Installing…" : "Install App";

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
              Install PrivacyEraser.ai for faster privacy scans
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                className="px-4 py-2 text-sm"
                disabled={installBusy}
                aria-busy={installBusy}
                onClick={() => void runOneTapInstall("banner")}
              >
                {installLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="px-4 py-2 text-sm"
                onClick={dismissBanner}
              >
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
              disabled={installBusy}
              onClick={() => void runOneTapInstall("floating")}
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
