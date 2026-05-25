"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type ScanStatusLike = "idle" | "scanning" | "complete" | string;

type OffshoreDot = {
  key: string;
  leftPct: number;
  topPct: number;
  delayMs: number;
  label: string;
};

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

export function getOffshorePulseDots(): OffshoreDot[] {
  // Approximate map positions (purely visual)
  return [
    { key: "moscow", leftPct: 63, topPct: 28, delayMs: 0, label: "Moscow" },
    { key: "beijing", leftPct: 74, topPct: 33, delayMs: 240, label: "Beijing" },
    { key: "eastern-europe", leftPct: 57, topPct: 32, delayMs: 520, label: "Eastern Europe" }
  ];
}

export function DarkMap({
  scanStatus,
  className
}: {
  scanStatus: ScanStatusLike;
  className?: string;
}) {
  const armed = scanStatus === "complete";
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (!armed) {
      setPulsing(false);
      return;
    }
    const t = window.setTimeout(() => setPulsing(true), 120);
    return () => window.clearTimeout(t);
  }, [armed]);

  const dots = useMemo(() => (armed ? getOffshorePulseDots() : []), [armed]);

  return (
    <Card className={cn("border border-danger/25 bg-slate-950/50", className)}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">Network Spread</p>
            <p className="mt-1 text-sm text-slate-300">Data detected on offshore bulletproof servers</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
              armed ? "border-danger/35 bg-danger/10 text-red-200" : "border-slate-700 text-slate-400"
            )}
          >
            {armed ? "Active" : "Standby"}
          </span>
        </div>

        <div className={cn("relative h-56 overflow-hidden rounded-xl border border-slate-800 bg-[radial-gradient(circle_at_50%_50%,rgba(30,41,59,0.75),rgba(2,6,23,0.98))]", armed && pulsing ? "leak-glitch" : "")}>
          <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:28px_28px]" />

          {/* Stylized world silhouette */}
          <div className="absolute inset-0 opacity-25 [mask-image:radial-gradient(circle_at_50%_40%,black,transparent_72%)]">
            <div className="absolute left-[10%] top-[35%] h-[32%] w-[26%] rounded-[40%] bg-slate-700/60 blur-[1px]" />
            <div className="absolute left-[28%] top-[46%] h-[22%] w-[18%] rounded-[45%] bg-slate-700/60 blur-[1px]" />
            <div className="absolute left-[45%] top-[30%] h-[30%] w-[34%] rounded-[48%] bg-slate-700/60 blur-[1px]" />
            <div className="absolute left-[70%] top-[48%] h-[18%] w-[18%] rounded-[48%] bg-slate-700/60 blur-[1px]" />
          </div>

          {dots.map((d) => (
            <div
              key={d.key}
              className="absolute"
              style={{
                left: `${clampPct(d.leftPct)}%`,
                top: `${clampPct(d.topPct)}%`,
                transform: "translate(-50%, -50%)"
              }}
              aria-label={d.label}
              title={d.label}
            >
              <span
                className={cn("leak-dot-pulse", armed && pulsing ? "opacity-100" : "opacity-0")}
                style={{ animationDelay: `${d.delayMs}ms` }}
              />
              <span className={cn("leak-dot-core", armed && pulsing ? "opacity-100" : "opacity-0")} />
            </div>
          ))}

          {!armed && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
                Offshore node scan activates when results complete
              </div>
            </div>
          )}
        </div>

        {armed && (
          <div className="text-xs text-slate-400">
            Highlighted regions: <span className="text-slate-200">Moscow</span>, <span className="text-slate-200">Beijing</span>,{" "}
            <span className="text-slate-200">Eastern Europe</span>
          </div>
        )}
      </div>
    </Card>
  );
}

