import { STORAGE_PLAN, STORAGE_SCAN_DATA, STORAGE_USER } from "@/lib/growth-constants";
import type { PeScanData, PeUser, UserPlan } from "@/types/funnel";

function safeJsonParse<T>(raw: string | null): T | null {
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function savePeScanData(data: PeScanData): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_SCAN_DATA, JSON.stringify(data));
  } catch {
    // quota / private mode
  }
}

function normalizePeScanData(raw: PeScanData | null): PeScanData | null {
  if (!raw) {
    return null;
  }
  const exposure = raw.exposurePercent;
  return {
    ...raw,
    exposureScore: raw.exposureScore ?? exposure,
    exposurePercent: exposure,
    anonymous: raw.anonymous ?? !raw.email?.trim(),
    brokerHits: raw.brokerHits ?? 0,
    brokersFound: raw.brokersFound ?? raw.brokerHits ?? 0
  };
}

export function getPeScanData(): PeScanData | null {
  if (typeof window === "undefined") {
    return null;
  }
  return normalizePeScanData(safeJsonParse<PeScanData>(window.localStorage.getItem(STORAGE_SCAN_DATA)));
}

export function savePeUser(user: PeUser): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_USER, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export function getPeUser(): PeUser | null {
  if (typeof window === "undefined") {
    return null;
  }
  return safeJsonParse<PeUser>(window.localStorage.getItem(STORAGE_USER));
}

export function clearPeUser(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_USER);
  } catch {
    // ignore
  }
}

export function getUserPlan(): UserPlan {
  if (typeof window === "undefined") {
    return "free";
  }
  const p = window.localStorage.getItem(STORAGE_PLAN);
  return p === "lifetime" ? "lifetime" : "free";
}

export function setUserPlan(plan: UserPlan): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_PLAN, plan);
  } catch {
    // ignore
  }
}
