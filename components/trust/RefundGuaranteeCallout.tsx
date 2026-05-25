"use client";

import { ShieldCheck } from "lucide-react";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";
import { cn } from "@/lib/utils";

const RG = COPY.refundGuarantee;

type Variant = "section" | "modal";

export function RefundGuaranteeCallout({ variant = "section", className }: { variant?: Variant; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.07] to-slate-950/40 px-4 py-3 shadow-inner shadow-emerald-950/20",
        variant === "modal" && "py-3.5",
        className
      )}
      role="note"
    >
      <div className="relative shrink-0">
        <div className="flex h-12 w-12 flex-col items-center justify-center rounded-full bg-emerald-500/[0.18] ring-2 ring-emerald-400/35">
          <span className="text-lg font-black tabular-nums leading-none tracking-tight text-emerald-50">
            {RG.sixtyDayMark}
          </span>
          <span className="-mt-0.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-emerald-200/90">
            {RG.sixtyDayMarkSub}
          </span>
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 ring-2 ring-emerald-500/40">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
        </span>
      </div>
      <p className="min-w-0 flex-1 text-left text-sm font-semibold leading-snug text-emerald-50/95 sm:text-[0.9375rem]">
        {RG.badgeLine}
      </p>
    </div>
  );
}
