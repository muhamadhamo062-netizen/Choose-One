"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useUnlockModal } from "@/hooks/useUnlockModal";
import { trackEvent } from "@/lib/analytics";
import { PWA_EVENT_PAYWALL_VIEWED, PWA_EVENT_SCAN_COMPLETE } from "@/lib/pwa-install-events";
import { cn } from "@/lib/utils";

const BANNER_DISMISS_KEY = "pe_pwa_install_banner_dismissed_v2";
const FLOAT_DISMISS_KEY = "pe_pwa_install_float_dismissed_v2";
const IOS_SHEET_SESSION_KEY = "pe_pwa_ios_install_sheet_dismissed_v2";
const IOS_RETURN_NUDGE_KEY = "pe_pwa_ios_return_nudge_v2";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }
  return Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
}

function isLikelyIOS(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return true;
  }
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function InstallPrompt() {
  const { isOpen: paywallOpen } = useUnlockModal();

  const [scanDone, setScanDone] = useState(false);
  /** True 12s after a completed scan (idle window). */
  const [postScanIdleReady, setPostScanIdleReady] = useState(false);
  /** True after the paywall was opened and then closed (session). */
  const [paywallClosed, setPaywallClosed] = useState(false);
  /** True once the paywall viewed custom event has fired (session on this mount). */
  const [paywallViewed, setPaywallViewed] = useState(false);
  /** True 15s after mount (engagement gate). */
  const [engagement15s, setEngagement15s] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [floatDismissed, setFloatDismissed] = useState(false);
  const [iosSheetOpen, setIosSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [noInstallHint, setNoInstallHint] = useState(false);

  const installCompletedFired = useRef(false);
  const shownBanner = useRef(false);
  const shownFloat = useRef(false);
  const shownIosSheet = useRef(false);
  const hiddenAtMs = useRef<number | null>(null);
  const paywallEverOpened = useRef(false);

  useEffect(() => {
    if (isStandaloneMode() || !paywallOpen) {
      return;
    }
    setIosSheetOpen(false);
  }, [paywallOpen]);

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
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
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

  useEffect(() => {
    if (!scanDone || !isLikelyIOS() || isStandaloneMode() || paywallOpen) {
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      try {
        if (sessionStorage.getItem(IOS_SHEET_SESSION_KEY) === "1") {
          return;
        }
      } catch {
        return;
      }
      setIosSheetOpen(true);
    }, 1800);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [scanDone, paywallOpen]);

  const installEligible =
    scanDone || postScanIdleReady || paywallClosed || paywallViewed || engagement15s;

  useEffect(() => {
    if (!isLikelyIOS() || isStandaloneMode() || !installEligible) {
      return;
    }
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtMs.current = Date.now();
        return;
      }
      const start = hiddenAtMs.current;
      hiddenAtMs.current = null;
      if (start == null) {
        return;
      }
      if (Date.now() - start < 2000) {
        return;
      }
      try {
        if (sessionStorage.getItem(IOS_RETURN_NUDGE_KEY) === "1") {
          return;
        }
        sessionStorage.setItem(IOS_RETURN_NUDGE_KEY, "1");
      } catch {
        return;
      }
      if (!paywallOpen) {
        setIosSheetOpen(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [installEligible, paywallOpen]);

  const openIosSheet = useCallback((surface: "banner" | "floating") => {
    trackEvent({ name: "install_clicked", surface });
    setIosSheetOpen(true);
  }, []);

  const runNativeInstall = useCallback(
    async (surface: "banner" | "floating") => {
      if (isLikelyIOS()) {
        openIosSheet(surface);
        return;
      }
      if (!deferred) {
        setNoInstallHint(true);
        window.setTimeout(() => setNoInstallHint(false), 8000);
        trackEvent({ name: "install_clicked", surface });
        return;
      }
      trackEvent({ name: "install_clicked", surface });
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted" && !installCompletedFired.current) {
          installCompletedFired.current = true;
          trackEvent({ name: "install_completed" });
        }
      } catch {
        // user dismissed
      } finally {
        setDeferred(null);
      }
    },
    [deferred, openIosSheet]
  );

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

  const dismissIosSheet = useCallback(() => {
    setIosSheetOpen(false);
    trackEvent({ name: "install_dismissed", surface: "ios_sheet" });
    try {
      sessionStorage.setItem(IOS_SHEET_SESSION_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  const showBanner = !isStandaloneMode() && !paywallOpen && !bannerDismissed && installEligible;
  const showFloat =
    !isStandaloneMode() && !paywallOpen && !floatDismissed && isMobile && installEligible;

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

  useEffect(() => {
    if (iosSheetOpen && !shownIosSheet.current) {
      shownIosSheet.current = true;
      trackEvent({ name: "install_prompt_shown", surface: "ios_sheet" });
    }
  }, [iosSheetOpen]);

  if (isStandaloneMode()) {
    return null;
  }

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
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              {noInstallHint && !isLikelyIOS() && !deferred && (
                <span className="text-xs text-amber-200/90">
                  Use your browser menu to add this site if you don’t see a prompt.
                </span>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="px-4 py-2 text-sm"
                  onClick={() => void runNativeInstall("banner")}
                >
                  Install App
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
              onClick={() => void runNativeInstall("floating")}
              className="group flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-3 pr-1 text-left transition hover:bg-slate-800/90"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Download className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 pr-1 text-xs font-semibold leading-tight text-white">
                Install App
              </span>
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

      {iosSheetOpen && !paywallOpen && (
        <div
          className="fixed inset-0 z-[105] flex items-end justify-center bg-black/55 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pe-ios-install-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
            <h2 id="pe-ios-install-title" className="text-lg font-semibold text-white">
              Install PrivacyEraser.ai on iPhone
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Works like an app — faster scanning and instant privacy checks from your home screen.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-200">
              <li>Tap the Share button</li>
              <li>Select &quot;Add to Home Screen&quot;</li>
              <li>Tap Add</li>
            </ol>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="px-4 py-2 text-sm"
                onClick={dismissIosSheet}
              >
                Not now
              </Button>
              <Button type="button" className="px-4 py-2 text-sm" onClick={dismissIosSheet}>
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
