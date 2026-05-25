import { STORAGE_SCAN_SESSION } from "@/lib/growth-constants";
import { getPeScanData, getPeUser, savePeScanData, savePeUser } from "./scan-storage";
import type { PeUser, PeScanData } from "@/types/funnel";

export type ScanSession = {
  scanId: string;
  email?: string;
  state?: string;
  exposureScore: number;
  brokersFound: number;
  createdAt: number;
};

export type ResolvedActiveScan = {
  scanId: string;
  exposureScore: number;
  brokersFound: number;
  state?: string;
  riskLevel?: PeScanData["riskLevel"];
};

/**
 * **Scanner is the only client writer** of a completed scan. Persists `pe_scan_session` first, then mirrors `pe_scan_data`.
 * Server sync uses {@link syncSessionFromServerAppliedScan} after the API applies a scan.
 */
export function commitScannerScanResult(pe: PeScanData): ScanSession {
  const scanId =
    pe.scanId ??
    (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `scan-${Date.now()}`);
  const exposure = pe.exposureScore ?? pe.exposurePercent;
  const brokers = pe.brokersFound ?? pe.brokerHits;
  const session = createScanSession({
    scanId,
    email: pe.email?.trim() || undefined,
    state: pe.stateCode,
    exposureScore: exposure,
    brokersFound: brokers
  });
  const aligned: PeScanData = {
    ...pe,
    scanId: session.scanId,
    exposureScore: exposure,
    exposurePercent: exposure,
    brokerHits: brokers,
    brokersFound: brokers
  };
  savePeScanData(aligned);
  return session;
}

/** After `savePeScanData` from server reconciliation — keeps session as the mirror of applied scan. */
export function syncSessionFromServerAppliedScan(pe: PeScanData): void {
  if (!pe.scanId || !pe.completedAt) {
    return;
  }
  const exposure = pe.exposureScore ?? pe.exposurePercent;
  const brokers = pe.brokersFound ?? pe.brokerHits;
  createScanSession({
    scanId: pe.scanId,
    email: pe.email?.trim() || undefined,
    state: pe.stateCode,
    exposureScore: exposure,
    brokersFound: brokers,
    createdAt: Date.parse(pe.completedAt) || Date.now()
  });
}

/**
 * Create or overwrite the latest scan session (used by `commitScannerScanResult` and repairs).
 */
export function createScanSession(
  data: Omit<ScanSession, "createdAt"> & { createdAt?: number }
): ScanSession {
  const session: ScanSession = {
    scanId: data.scanId,
    email: data.email,
    state: data.state,
    exposureScore: data.exposureScore,
    brokersFound: data.brokersFound,
    createdAt: data.createdAt ?? Date.now()
  };
  if (typeof window === "undefined") {
    return session;
  }
  try {
    window.localStorage.setItem(STORAGE_SCAN_SESSION, JSON.stringify(session));
  } catch {
    // ignore
  }
  return session;
}

export function getLatestScanSession(): ScanSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_SCAN_SESSION);
    if (!raw) {
      return null;
    }
    const p = JSON.parse(raw) as Partial<ScanSession>;
    if (!p.scanId || typeof p.exposureScore !== "number" || typeof p.brokersFound !== "number" || !p.createdAt) {
      return null;
    }
    return p as ScanSession;
  } catch {
    return null;
  }
}

/**
 * **Strict priority**
 * 1. `pe_scan_session` (PRIMARY) — if present, `pe_scan_data` is only read for `riskLevel` when `scanId` matches
 * 2. `pe_user.scanId` + `pe_scan_data` with the same `scanId`
 * 3. Legacy `pe_scan_data` (completed scan, no valid session) — not mixed with session when session exists
 */
export function getResolvedActiveScan(): ResolvedActiveScan | null {
  if (typeof window === "undefined") {
    return null;
  }
  const session = getLatestScanSession();
  const d = getPeScanData();
  const u = getPeUser();

  if (u?.scanId && d?.scanId && u.scanId !== d.scanId) {
    return null;
  }

  if (session) {
    const risk = d && d.scanId === session.scanId ? d.riskLevel : undefined;
    return {
      scanId: session.scanId,
      exposureScore: session.exposureScore,
      brokersFound: session.brokersFound,
      state: session.state,
      riskLevel: risk
    };
  }

  if (u?.scanId && d && d.scanId === u.scanId) {
    return {
      scanId: d.scanId,
      exposureScore: d.exposureScore ?? d.exposurePercent,
      brokersFound: d.brokersFound ?? d.brokerHits,
      state: d.stateCode,
      riskLevel: d.riskLevel
    };
  }

  if (d?.completedAt) {
    return {
      scanId: d.scanId ?? "legacy",
      exposureScore: d.exposureScore ?? d.exposurePercent,
      brokersFound: d.brokersFound ?? d.brokerHits,
      state: d.stateCode,
      riskLevel: d.riskLevel
    };
  }

  return null;
}

/**
 * `pe_user.scanId` and `hasScan` come only from a real `pe_scan_session` (signup attach).
 * Does not read `pe_scan_data` to assign `scanId`.
 */
export function attachScanToUser(email: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const u = getPeUser();
  if (!u || u.email.toLowerCase() !== email.trim().toLowerCase()) {
    return;
  }
  const session = getLatestScanSession();
  if (session) {
    const next: PeUser = { ...u, scanId: session.scanId, hasScan: true };
    savePeUser(next);
    if (!session.email) {
      try {
        const patched: ScanSession = { ...session, email: email.trim().toLowerCase() };
        window.localStorage.setItem(STORAGE_SCAN_SESSION, JSON.stringify(patched));
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Align session, user, and mirrored scan data. Run on app bootstrap and after repairs.
 * — session wins over mismatched `pe_scan_data` / `pe_user.scanId`
 * — if user has `scanId` but session missing, reconstruct from `pe_scan_data` when IDs match
 */
export function reconcileScanStorageState(): void {
  if (typeof window === "undefined") {
    return;
  }
  let session = getLatestScanSession();
  let d = getPeScanData();
  const u0 = getPeUser();

  if (session && d && d.scanId && d.scanId !== session.scanId) {
    // eslint-disable-next-line no-console -- production diagnostic; replace with Sentry
    console.warn(
      "[SCAN DESYNC FIXED] pe_scan_data.scanId !== pe_scan_session; aligning data to session (session wins)"
    );
    const merged: PeScanData = {
      ...d,
      scanId: session.scanId,
      exposureScore: session.exposureScore,
      exposurePercent: session.exposureScore,
      brokerHits: session.brokersFound,
      brokersFound: session.brokersFound,
      stateCode: session.state ?? d.stateCode
    };
    savePeScanData(merged);
    d = getPeScanData();
  }

  session = getLatestScanSession();
  if (session && u0 && u0.scanId && u0.scanId !== session.scanId) {
    // eslint-disable-next-line no-console -- production diagnostic
    console.warn("[SCAN DESYNC FIXED] pe_user.scanId !== pe_scan_session; aligning user to session");
    savePeUser({ ...u0, scanId: session.scanId, hasScan: true });
  }

  session = getLatestScanSession();
  d = getPeScanData();
  const u1 = getPeUser();

  if (!session && u1?.scanId && d && d.scanId === u1.scanId) {
    createScanSession({
      scanId: d.scanId,
      email: d.email || undefined,
      state: d.stateCode,
      exposureScore: d.exposureScore ?? d.exposurePercent,
      brokersFound: d.brokersFound ?? d.brokerHits,
      createdAt: d.completedAt ? Date.parse(d.completedAt) : Date.now()
    });
  }

  session = getLatestScanSession();
  d = getPeScanData();
  const u2 = getPeUser();

  if (!session && u2?.scanId && (!d || d.scanId !== u2.scanId)) {
    // eslint-disable-next-line no-console -- production diagnostic
    console.warn("[SCAN DESYNC FIXED] orphan pe_user.scanId; clearing user scan link");
    savePeUser({ ...u2, scanId: undefined, hasScan: false });
  }

  d = getPeScanData();
  const u3 = getPeUser();
  if (!getLatestScanSession() && d?.scanId && d.completedAt && (!u3 || !u3.scanId)) {
    createScanSession({
      scanId: d.scanId,
      email: d.email || undefined,
      state: d.stateCode,
      exposureScore: d.exposureScore ?? d.exposurePercent,
      brokersFound: d.brokersFound ?? d.brokerHits,
      createdAt: d.completedAt ? Date.parse(d.completedAt) : Date.now()
    });
  }
}

export function getScanAnalyticsDimensions(): {
  exposure_score: string;
  broker_count: string;
  us_state: string;
} {
  if (typeof window === "undefined") {
    return { exposure_score: "0", broker_count: "0", us_state: "" };
  }
  const r = getResolvedActiveScan();
  if (r) {
    return {
      exposure_score: String(r.exposureScore),
      broker_count: String(r.brokersFound),
      us_state: r.state?.trim() ?? ""
    };
  }
  return { exposure_score: "0", broker_count: "0", us_state: "" };
}
