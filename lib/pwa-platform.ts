export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }
  return Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
}

export function isLikelyIOS(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return true;
  }
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function isLikelyAndroid(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /Android/i.test(navigator.userAgent);
}

export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;
  return /FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|Snapchat|TikTok/i.test(ua);
}

/** iOS: opens the system Share sheet (Add to Home Screen lives there). */
export async function openIosInstallShareSheet(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share) {
    return false;
  }
  try {
    await navigator.share({
      title: "PrivacyEraser.ai",
      text: "Install PrivacyEraser for faster privacy scans",
      url: window.location.href
    });
    return true;
  } catch {
    return false;
  }
}

/** In-app WebViews cannot install — open the page in the system browser (no modal). */
export function openInSystemBrowser(): void {
  const url = window.location.href;
  if (isLikelyAndroid()) {
    const stripped = url.replace(/^https?:\/\//, "");
    window.location.href = `intent://${stripped}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
