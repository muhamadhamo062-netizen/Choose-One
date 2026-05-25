/**
 * Client-side schedule simulation (localStorage) — not authoritative.
 * NOT USED as dashboard source of truth; monitoring is not persisted on the server in this app.
 */

import { STORAGE_MONITORING } from "@/lib/growth-constants";

const DEFAULT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export interface MonitoringState {
  nextRescanAt: string;
  lastRescanAt: string | null;
  reappearanceFlags: { brokerName: string; at: string }[];
  active: boolean;
  intervalMs: number;
}

function defaultState(): MonitoringState {
  return {
    nextRescanAt: new Date(Date.now() + DEFAULT_INTERVAL_MS).toISOString(),
    lastRescanAt: null,
    reappearanceFlags: [],
    active: false,
    intervalMs: DEFAULT_INTERVAL_MS
  };
}

export function loadMonitoringState(): MonitoringState {
  if (typeof window === "undefined") {
    return defaultState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_MONITORING);
    if (!raw) {
      return defaultState();
    }
    return { ...defaultState(), ...JSON.parse(raw) } as MonitoringState;
  } catch {
    return defaultState();
  }
}

function save(s: MonitoringState): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_MONITORING, JSON.stringify(s));
  } catch {
    // ignore
  }
}

export function enableMonitoringForUser(_userId: string | undefined, intervalMs = DEFAULT_INTERVAL_MS): MonitoringState {
  const s = loadMonitoringState();
  s.active = true;
  s.intervalMs = intervalMs;
  s.nextRescanAt = new Date(Date.now() + intervalMs).toISOString();
  save(s);
  return s;
}

export function recordRescanCompleted(): MonitoringState {
  const s = loadMonitoringState();
  s.lastRescanAt = new Date().toISOString();
  s.nextRescanAt = new Date(Date.now() + s.intervalMs).toISOString();
  save(s);
  return s;
}

export function flagReappearance(brokerName: string): MonitoringState {
  const s = loadMonitoringState();
  s.reappearanceFlags.unshift({ brokerName, at: new Date().toISOString() });
  s.reappearanceFlags = s.reappearanceFlags.slice(0, 50);
  save(s);
  return s;
}

export function isRescanDue(): boolean {
  const s = loadMonitoringState();
  if (!s.active) {
    return false;
  }
  return Date.parse(s.nextRescanAt) <= Date.now();
}
