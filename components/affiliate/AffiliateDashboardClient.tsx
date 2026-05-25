"use client";

import { useEffect, useMemo, useState } from "react";

type StatsResponse = {
  ok: true;
  affiliate: { id: string; name: string; email: string; code: string };
  metrics: {
    visits: number;
    sales: number;
    earnings: number;
    balance: number;
    pendingPayout: number;
    paidOut: number;
    conversionRate: number;
    epc: number;
  };
  chart: { month: string; visits: number; sales: number; earnings: number }[];
  filter: "7d" | "30d" | "all";
};

export function AffiliateDashboardClient() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<"7d" | "30d" | "all">("30d");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const response = await fetch(`/api/affiliate/stats?range=${range}`, { credentials: "include", cache: "no-store" });
      const json = (await response.json().catch(() => null)) as StatsResponse | null;
      if (cancelled) {
        return;
      }
      if (!response.ok || !json) {
        setError("Unable to load affiliate stats.");
        return;
      }
      setData(json);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const referralLink = useMemo(() => {
    if (!data) {
      return "";
    }
    return `/?ref=${data.affiliate.code}`;
  }, [data]);

  if (error) {
    return <p className="text-sm text-red-300">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-400">Loading affiliate analytics...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h1 className="text-2xl font-bold text-white">Affiliate Dashboard</h1>
        <div className="mt-3 flex gap-2">
          {(["7d", "30d", "all"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              className={`rounded-md px-3 py-1 text-xs ${range === item ? "bg-primary text-white" : "bg-slate-800 text-slate-300"}`}
            >
              {item === "all" ? "All time" : item}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-300">Referral Link: <span className="font-mono">{referralLink}</span></p>
      </div>
      <div className="grid gap-4 sm:grid-cols-7">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-400">Visits</p>
          <p className="mt-2 text-2xl font-bold text-white">{data.metrics.visits}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-400">Sales</p>
          <p className="mt-2 text-2xl font-bold text-white">{data.metrics.sales}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-400">Earnings</p>
          <p className="mt-2 text-2xl font-bold text-white">${data.metrics.earnings.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-400">Pending payout</p>
          <p className="mt-2 text-2xl font-bold text-amber-300">${data.metrics.pendingPayout.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-400">Paid out</p>
          <p className="mt-2 text-2xl font-bold text-emerald-300">${data.metrics.paidOut.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-400">Conversion rate</p>
          <p className="mt-2 text-2xl font-bold text-white">{(data.metrics.conversionRate * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-400">EPC</p>
          <p className="mt-2 text-2xl font-bold text-white">${data.metrics.epc.toFixed(2)}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Monthly performance</h2>
        <div className="space-y-3">
          {data.chart.length === 0 ? (
            <p className="text-sm text-slate-400">No chart data yet.</p>
          ) : (
            data.chart.map((row) => {
              const max = Math.max(1, row.visits);
              const salesWidth = Math.min(100, (row.sales / max) * 100);
              return (
                <div key={row.month} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{row.month}</span>
                    <span>
                      Visits: {row.visits} | Sales: {row.sales}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded bg-slate-800">
                    <div className="h-full bg-blue-400" style={{ width: "100%" }} />
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded bg-slate-800">
                    <div className="h-full bg-emerald-400" style={{ width: `${salesWidth}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
