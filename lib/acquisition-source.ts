import { STORAGE_ACQUISITION_SOURCE, STORAGE_PENDING_REFERRAL } from "@/lib/growth-constants";

/**
 * US traffic acquisition bucket for analytics. First-touch is stored in localStorage.
 */
export type AcquisitionSource = "tiktok" | "reddit" | "google" | "direct";

function normalizeFromParams(search: string): AcquisitionSource {
  const p = new URLSearchParams(search);
  if (p.get("gclid") || p.get("gad_source")) {
    return "google";
  }
  const raw = (p.get("utm_source") || p.get("source") || "").toLowerCase().trim();
  if (raw === "tiktok" || raw === "tt" || raw === "tiktok_ads") {
    return "tiktok";
  }
  if (raw === "reddit" || raw === "rd") {
    return "reddit";
  }
  if (raw === "google" || raw === "g" || raw === "google_ads" || raw === "adwords") {
    return "google";
  }
  return "direct";
}

export function getAcquisitionSource(): AcquisitionSource {
  if (typeof window === "undefined") {
    return "direct";
  }
  try {
    const v = window.localStorage.getItem(STORAGE_ACQUISITION_SOURCE);
    if (v === "tiktok" || v === "reddit" || v === "google" || v === "direct") {
      return v;
    }
  } catch {
    // ignore
  }
  return "direct";
}

/**
 * First-touch: records acquisition from the current URL once per device (until cleared).
 */
export function captureAcquisitionSourceFromWindow(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (window.localStorage.getItem(STORAGE_ACQUISITION_SOURCE)) {
      return;
    }
  } catch {
    return;
  }
  const v = normalizeFromParams(window.location.search);
  try {
    window.localStorage.setItem(STORAGE_ACQUISITION_SOURCE, v);
  } catch {
    // ignore
  }
}

/**
 * Run on each load: `?ref=PE-...` or `?referral_code=...` (same intent as ref).
 */
export function captureReferralCodeFromUrl(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const p = new URLSearchParams(window.location.search);
    const r = (p.get("ref") ?? p.get("referral_code") ?? "").trim().toUpperCase();
    if (r.startsWith("PE-") && r.length >= 6) {
      window.localStorage.setItem(STORAGE_PENDING_REFERRAL, r);
    }
  } catch {
    // ignore
  }
}
