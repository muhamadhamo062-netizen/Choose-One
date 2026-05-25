"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type Row = { broker: string; status: string; detail: string | null };
type FeedLine = { id: string; text: string; ts: number; simulated: boolean };

export function NukeDashboardClient({
  initialRows,
  initialError
}: {
  initialRows: Row[] | null;
  initialError: string | null;
}) {
  const [rows, setRows] = useState<Row[] | null>(initialRows);
  const [error, setError] = useState<string | null>(initialError);
  const [launching, setLaunching] = useState(false);
  const [impact, setImpact] = useState(false);
  const [feed, setFeed] = useState<FeedLine[]>([]);
  const [caseReportUrl, setCaseReportUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/nuke/progress", { method: "GET", cache: "no-store" });
        const body = (await res.json().catch(() => null)) as any;
        if (!alive) return;
        if (!res.ok || !body?.ok) {
          setError(body?.error || `http_${res.status}`);
          setRows(null);
          return;
        }
        setError(null);
        setRows(Array.isArray(body.rows) ? body.rows : []);
      } catch {
        if (!alive) return;
        setError("network_error");
        setRows(null);
      }
    };
    // If we already have SSR rows, don't block the UI; just start polling.
    void tick();
    const t = window.setInterval(tick, 2000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/nuke/feed", { method: "GET", cache: "no-store" });
        const body = (await res.json().catch(() => null)) as any;
        if (!alive) return;
        if (!res.ok || !body?.ok) {
          return;
        }
        const lines = Array.isArray(body.lines) ? body.lines : [];
        setFeed((prev) => {
          const seen = new Set(prev.filter((x) => !x.simulated).map((x) => x.id));
          const incoming: FeedLine[] = [];
          for (const l of lines) {
            if (!l || typeof l.id !== "string" || typeof l.text !== "string") continue;
            if (seen.has(l.id)) continue;
            incoming.push({ id: l.id, text: l.text, ts: Date.now(), simulated: false });
          }
          const merged = [...prev.filter((x) => !x.simulated), ...incoming];
          return merged.slice(-60);
        });
      } catch {
        // ignore
      }
    };
    void tick();
    const t = window.setInterval(tick, 2000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/nuke/case-report", { method: "GET", cache: "no-store" });
        const body = (await res.json().catch(() => null)) as any;
        if (!alive) return;
        if (res.ok && body?.ok && body.ready && typeof body.url === "string") {
          setCaseReportUrl(body.url);
        }
      } catch {
        // ignore
      }
    };
    void tick();
    const t = window.setInterval(tick, 2500);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    // Simulated “busy/high-tech” logs when server is quiet.
    let alive = true;
    const templates = [
      "[SYSTEM] Generating DMCA PDF for user_772...",
      "[NETWORK] Handshake established with Spokeo legal servers...",
      "[SYSTEM] Compiling evidence packet + headers...",
      "[NETWORK] Routing request through secure relay...",
      "[SUCCESS] Removal request #8821 indexed..",
      "[SYSTEM] Hashing identity signals (SHA-256)...",
      "[NETWORK] TLS channel pinned. Transmitting notice..."
    ];
    const t = window.setInterval(() => {
      if (!alive) return;
      // Only simulate if we have no fresh real logs recently.
      const now = Date.now();
      const lastReal = [...feed].reverse().find((x) => !x.simulated);
      const quiet = !lastReal || now - lastReal.ts > 6000;
      if (!quiet) return;
      const text = templates[Math.floor(Math.random() * templates.length)]!;
      setFeed((prev) => {
        const id = `sim_${now}_${Math.random().toString(16).slice(2, 8)}`;
        const next = [...prev, { id, text, ts: now, simulated: true }];
        return next.slice(-60);
      });
    }, 1600);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [feed]);

  const canLaunch = !error && !launching;
  const allSent = (rows ?? []).length > 0 && (rows ?? []).every((r) => r.status === "Legal Notice Sent" || r.status === "Pending Deletion");

  const header = useMemo(() => {
    if (error === "paid_required") return "Paid protection required";
    if (error === "unauthorized") return "Please log in to view removal progress";
    if (error) return "Removal progress unavailable";
    return "Real-time Removal Progress";
  }, [error]);

  return (
    <motion.div
      animate={impact ? { x: [0, -8, 7, -6, 5, 0] } : { x: 0 }}
      transition={{ duration: 0.32, ease: "easeInOut" }}
      onAnimationComplete={() => setImpact(false)}
      className="relative"
    >
      {impact && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 rounded-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.18, 0] }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          style={{ background: "radial-gradient(circle at 50% 40%, rgba(239,68,68,0.28), transparent 60%)" }}
        />
      )}

      <Card className="border border-danger/25 bg-slate-950/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">Auto-Remover / Nuke</p>
          <h2 className="mt-1 text-xl font-extrabold text-white">{header}</h2>
          <p className="mt-1 text-sm text-slate-300">We continuously send legal takedown notices and track deletion state.</p>
        </div>
        <Badge className={cn(error ? "border-slate-700 bg-slate-900/40 text-slate-300" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200")}>
          {error ? "Offline" : "Live"}
        </Badge>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={!canLaunch}
          onClick={() => {
            setImpact(true);
            if (!canLaunch) return;
            setLaunching(true);
            void fetch("/api/nuke/trigger", { method: "POST" })
              .then(async (r) => {
                const b = await r.json().catch(() => null);
                if (!r.ok || !b?.ok) {
                  setError(b?.error || `http_${r.status}`);
                }
              })
              .finally(() => {
                setLaunching(false);
              });
          }}
          className={cn(
            "relative w-full overflow-hidden rounded-xl border px-4 py-3 text-sm font-extrabold uppercase tracking-wide transition sm:w-auto",
            canLaunch
              ? "border-danger/40 bg-gradient-to-r from-red-600/30 via-red-500/20 to-red-600/30 text-red-100 shadow-[0_0_40px_rgba(239,68,68,0.18)] hover:border-danger/60"
              : "border-slate-800 bg-slate-900/30 text-slate-500"
          )}
        >
          <span className="relative z-10">{launching ? "Launching..." : "Launch Nuke Now"}</span>
          {canLaunch && (
            <motion.span
              aria-hidden
              className="absolute inset-0"
              animate={{ opacity: [0.35, 0.1, 0.35] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              style={{
                background:
                  "radial-gradient(circle at 50% 40%, rgba(239,68,68,0.35), transparent 60%)"
              }}
            />
          )}
        </button>
        <p className="text-xs text-slate-400">
          {error === "paid_required"
            ? "Paid users only."
            : "Triggers immediate legal takedown notices and evidence generation."}
        </p>
      </div>

      <div className="mt-3">
        <button
          type="button"
          disabled={!allSent || !caseReportUrl}
          onClick={() => {
            if (!caseReportUrl) return;
            window.open(caseReportUrl, "_blank", "noopener,noreferrer");
          }}
          className={cn(
            "w-full rounded-xl border px-4 py-3 text-sm font-extrabold uppercase tracking-wide transition",
            allSent && caseReportUrl
              ? "border-indigo-400/30 bg-indigo-400/10 text-indigo-200 hover:border-indigo-400/50"
              : "border-slate-800 bg-slate-900/30 text-slate-500"
          )}
        >
          Download Case Report
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
          {error === "paid_required"
            ? "Upgrade to a paid plan to view and run the auto-remover."
            : error === "unauthorized"
              ? "Log in to access your removal dashboard."
              : "We couldn't load your removal status right now."}
        </div>
      )}

      <div className="mt-5 grid gap-2">
        {(rows ?? [
          { broker: "Whitepages", status: "Targeting...", detail: null },
          { broker: "Spokeo", status: "Targeting...", detail: null },
          { broker: "MyLife", status: "Targeting...", detail: null },
          { broker: "Radaris", status: "Targeting...", detail: null },
          { broker: "Intelius", status: "Targeting...", detail: null }
        ]).map((r) => {
          const tone =
            r.status === "Legal Notice Sent"
              ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
              : r.status === "Pending Deletion"
                ? "border-indigo-400/25 bg-indigo-400/10 text-indigo-200"
                : "border-red-500/20 bg-red-500/10 text-red-200";

          return (
            <div key={r.broker} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/35 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{r.broker}</p>
                {r.detail ? <p className="mt-0.5 text-xs text-slate-400">{r.detail}</p> : null}
              </div>
              <span className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide", tone)}>
                {r.status}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-red-500/20 bg-black/40 p-4 shadow-[0_0_40px_rgba(239,68,68,0.10)]">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-300">Live Operations Feed</p>
          <motion.span
            aria-hidden
            className="h-2 w-2 rounded-full bg-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.65)]"
            animate={{ opacity: [1, 0.35, 1] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <div className="max-h-52 overflow-auto rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 font-mono text-[11px] leading-relaxed">
          {feed.length === 0 ? (
            <div className="text-slate-400">Waiting for operations…</div>
          ) : (
            feed.slice(-22).map((l) => (
              <div
                key={l.id}
                className={cn(
                  "whitespace-pre-wrap break-words",
                  l.text.startsWith("[SUCCESS]") ? "text-emerald-200" : "",
                  l.text.startsWith("[NETWORK]") ? "text-indigo-200" : "",
                  l.text.startsWith("[SYSTEM]") ? "text-slate-200" : "",
                  l.text.startsWith("[ALERT]") ? "text-red-200" : "",
                  l.simulated ? "opacity-70" : "opacity-100"
                )}
              >
                {l.text}
              </div>
            ))
          )}
          <motion.div
            aria-hidden
            className="mt-1 inline-block h-3 w-2 align-middle bg-red-400/80"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </div>
      </Card>
    </motion.div>
  );
}

