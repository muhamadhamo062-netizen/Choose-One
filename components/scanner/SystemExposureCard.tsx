"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { collectSystemExposureSnapshot, type SystemExposureSnapshot } from "@/lib/system-exposure";

function formatBattery(b: NonNullable<SystemExposureSnapshot["battery"]>): string {
  const pct = Math.round(b.level * 100);
  const charging = b.charging ? "charging" : "discharging";
  return `${pct}% (${charging})`;
}

function formatMaybe(value: string | null | undefined, fallback = "Unavailable"): string {
  const v = typeof value === "string" ? value.trim() : "";
  return v ? v : fallback;
}

export function SystemExposureCard({ className }: { className?: string }) {
  const [snapshot, setSnapshot] = useState<SystemExposureSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void collectSystemExposureSnapshot()
      .then((s) => {
        if (cancelled) return;
        setSnapshot(s);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const internalIpLabel = useMemo(() => {
    const ips = snapshot?.internalIps ?? [];
    if (ips.length === 0) return "Unavailable";
    if (ips.length === 1) return ips[0]!;
    return `${ips[0]} (+${ips.length - 1} more)`;
  }, [snapshot?.internalIps]);

  return (
    <Card
      className={cn(
        "border border-danger/25 bg-slate-950/50",
        className
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">System Exposure</p>
            <p className="mt-1 text-sm text-slate-300">
              {loading ? "Collecting device + session signals..." : "Live session signals captured from your browser."}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
              loading ? "border-slate-700 text-slate-400" : "border-danger/35 bg-danger/10 text-red-200"
            )}
          >
            {loading ? "Scanning" : "Tracked"}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Internal IP (LAN)</p>
            <p className="mt-1 break-all text-sm font-mono text-slate-100">{internalIpLabel}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Battery status</p>
            <p className="mt-1 text-sm font-mono text-slate-100">
              {snapshot?.battery ? formatBattery(snapshot.battery) : "Unavailable"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5 sm:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Device model / user agent</p>
            <p className="mt-1 break-words text-sm font-mono text-slate-100">{formatMaybe(snapshot?.deviceModel)}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">City (IP lookup)</p>
            <p className="mt-1 text-sm font-mono text-slate-100">{formatMaybe(snapshot?.city)}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Collection method</p>
            <p className="mt-1 text-sm text-slate-200">
              WebRTC · Battery API · UA-CH · `ipwho.is`
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

