import { STORAGE_OUTGOING_REFERRAL, STORAGE_PENDING_REFERRAL } from "@/lib/growth-constants";

const PE_INCOMING = /^PE-[A-Z0-9-]{2,}$/i;

/**
 * Public landing + scroll to the scanner. Query preserves referral intent; hash is the scroll target.
 */
export function buildReferralLandingUrl(referralCode: string): string {
  if (typeof window === "undefined") {
    return "";
  }
  const u = new URL(window.location.origin);
  u.pathname = "/";
  u.searchParams.set("ref", referralCode);
  u.hash = "scanner";
  return u.toString();
}

/**
 * Resolves a stable `PE-…` code for links: prefers stored, else scan-based, else a short local id.
 * Client-only; returns empty string on the server.
 */
export function getOrCreateOutgoingReferralCode(scanId: string | null): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    const ex = window.localStorage.getItem(STORAGE_OUTGOING_REFERRAL);
    if (ex && PE_INCOMING.test(ex) && ex.length >= 6) {
      return ex.toUpperCase();
    }
  } catch {
    // ignore
  }
  let code: string;
  if (scanId && scanId.length > 0) {
    const core = scanId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12);
    const suffix = core.length > 0 ? core : "SCAN";
    code = `PE-${suffix}`;
  } else {
    const rand =
      typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
        : Math.random().toString(36).slice(2, 10).toUpperCase();
    code = `PE-${rand}`;
  }
  if (code.length < 6) {
    code = (code + "PEXXXX").slice(0, 8);
  }
  try {
    window.localStorage.setItem(STORAGE_OUTGOING_REFERRAL, code);
  } catch {
    // ignore
  }
  return code;
}

export function getStoredOutgoingReferralCode(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const v = window.localStorage.getItem(STORAGE_OUTGOING_REFERRAL);
    if (v && PE_INCOMING.test(v) && v.length >= 6) {
      return v.toUpperCase();
    }
  } catch {
    // ignore
  }
  return null;
}

export function getPendingReferralCodeForAttribution(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const v = (window.localStorage.getItem(STORAGE_PENDING_REFERRAL) ?? "").trim().toUpperCase();
    if (v.startsWith("PE-") && v.length >= 6) {
      return v;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Referred user completed a scan: pending ref exists and is not the same as our own outgoing (test edge case).
 */
export function shouldCountReferralConversion(_scanId: string): boolean {
  const pending = getPendingReferralCodeForAttribution();
  if (!pending) {
    return false;
  }
  const outgoing = getStoredOutgoingReferralCode();
  if (outgoing && pending === outgoing) {
    return false;
  }
  return true;
}
