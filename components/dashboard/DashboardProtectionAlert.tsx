"use client";

import { ShieldCheck } from "lucide-react";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";
import { cn } from "@/lib/utils";

const BANNER = COPY.dashboard.protectionBanner;

type DashboardProtectionAlertProps = {
  active: boolean;
  className?: string;
};

export function DashboardProtectionAlert({ active, className }: DashboardProtectionAlertProps) {
  if (!active) {
    return null;
  }

  return (
    <div
      className={cn(
        "mb-6 overflow-hidden rounded-2xl border-2 border-emerald-500/45 bg-gradient-to-r from-emerald-950/70 via-slate-950 to-slate-900/90 p-4 shadow-[0_0_32px_rgba(16,185,129,0.15)] sm:p-5",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex shrink-0 items-center justify-center sm:justify-start">
          <span className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/15 sm:h-14 sm:w-14">
            <span className="absolute inset-0 animate-ping rounded-xl border border-emerald-400/25 opacity-50" aria-hidden />
            <ShieldCheck
              className="relative h-7 w-7 text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.65)] sm:h-8 sm:w-8"
              aria-hidden
            />
          </span>
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">{BANNER.headline}</p>
          <p className="mt-1.5 text-base font-semibold leading-snug text-white sm:text-lg">{BANNER.body}</p>
        </div>
        <span className="hidden shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-200 sm:inline-flex">
          Live
        </span>
      </div>
    </div>
  );
}
