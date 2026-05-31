/** Scroll viewport to the scan results anchor (mobile-safe: header offset + retries). */
export function scrollToScanResultsAnchor(): void {
  if (typeof window === "undefined") {
    return;
  }
  const el = document.getElementById("scan-results");
  if (!el) {
    return;
  }

  const header = document.querySelector("header");
  const headerH = header instanceof HTMLElement ? header.offsetHeight : 72;
  const top = el.getBoundingClientRect().top + window.scrollY - headerH - 12;

  const mobile = window.matchMedia("(max-width: 768px)").matches;
  window.scrollTo({
    top: Math.max(0, top),
    behavior: mobile ? "auto" : "smooth"
  });

  try {
    el.focus({ preventScroll: true });
  } catch {
    // ignore
  }
}

/** Mobile layout/animation often needs a few passes before the anchor is measurable. */
export function scrollToScanResultsWithRetry(): void {
  scrollToScanResultsAnchor();
  window.setTimeout(scrollToScanResultsAnchor, 180);
  window.setTimeout(scrollToScanResultsAnchor, 450);
  window.setTimeout(scrollToScanResultsAnchor, 900);
}
