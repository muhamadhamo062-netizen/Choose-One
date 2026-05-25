"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type AdminStats = {
  ok: true;
  rows: Array<{
    id: string;
    name: string;
    email: string;
    code: string;
    visits: number;
    sales: number;
    earnings: number;
    pendingPayout: number;
    paidOut: number;
    conversionRate: number;
    epc: number;
  }>;
};

export function AdminAffiliatesClient() {
  const [data, setData] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<"7d" | "30d" | "all">("30d");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const response = await fetch(`/api/admin/affiliates/stats?range=${range}`, {
        credentials: "include",
        cache: "no-store"
      });
      const json = (await response.json().catch(() => null)) as AdminStats | null;
      if (cancelled) {
        return;
      }
      if (!response.ok || !json) {
        setError("Unauthorized or failed to load.");
        return;
      }
      setData(json);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [range, reloadTick]);

  const createAffiliate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await fetch("/api/admin/affiliates/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, code })
    });
    const json = (await response.json().catch(() => null)) as { temporaryPassword?: string } | null;
    if (!response.ok || !json?.temporaryPassword) {
      setError("Failed to create affiliate.");
      return;
    }
    setCreatedSecret(json.temporaryPassword);
    setName("");
    setEmail("");
    setCode("");
    setReloadTick((v) => v + 1);
  };

  const markPaid = async (affiliateId: string) => {
    const response = await fetch("/api/admin/affiliates/mark-paid", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ affiliateId })
    });
    if (!response.ok) {
      setError("Failed to mark payouts as paid.");
      return;
    }
    setReloadTick((v) => v + 1);
  };

  if (error) {
    return <p className="text-sm text-red-300">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-400">Loading admin affiliate data...</p>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h1 className="text-2xl font-bold text-white">Affiliate Performance</h1>
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
      </div>

      <form onSubmit={createAffiliate} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-white">Create Affiliate</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" placeholder="Code (optional)" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <button type="submit" className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">
          Create with random password
        </button>
        {createdSecret && <p className="mt-2 text-sm text-emerald-300">Temporary password: <span className="font-mono">{createdSecret}</span></p>}
      </form>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm text-slate-300">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Code</th>
              <th className="py-2 pr-4">Visits</th>
              <th className="py-2 pr-4">Sales</th>
              <th className="py-2 pr-4">Earnings</th>
              <th className="py-2 pr-4">Pending payout</th>
              <th className="py-2 pr-4">Paid out</th>
              <th className="py-2 pr-4">Conv. rate</th>
              <th className="py-2 pr-4">EPC</th>
              <th className="py-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-900">
                <td className="py-2 pr-4">{row.name}</td>
                <td className="py-2 pr-4">{row.email}</td>
                <td className="py-2 pr-4 font-mono">{row.code}</td>
                <td className="py-2 pr-4">{row.visits}</td>
                <td className="py-2 pr-4">{row.sales}</td>
                <td className="py-2 pr-4">${row.earnings.toFixed(2)}</td>
                <td className="py-2 pr-4 text-amber-300">${row.pendingPayout.toFixed(2)}</td>
                <td className="py-2 pr-4 text-emerald-300">${row.paidOut.toFixed(2)}</td>
                <td className="py-2 pr-4">{(row.conversionRate * 100).toFixed(1)}%</td>
                <td className="py-2 pr-4">${row.epc.toFixed(2)}</td>
                <td className="py-2 pr-4">
                  <button
                    type="button"
                    onClick={() => void markPaid(row.id)}
                    className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    disabled={row.pendingPayout <= 0}
                  >
                    Mark as Paid
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
