import { Radar, ShieldAlert } from "lucide-react";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";
import { cn } from "@/lib/utils";

const SHIELD = COPY.securityShield;

type DarkWebSurveillanceShieldProps = {
  className?: string;
  /** `scannerProminent` = below Run Exposure Scan CTA; `full` = standalone section. */
  variant?: "full" | "scannerProminent";
};

function ShieldIcon({ size = "md" }: { size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-[5.25rem] w-[5.25rem] sm:h-24 sm:w-24" : "h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20";
  const icon = size === "lg" ? "h-11 w-11 sm:h-12 sm:w-12" : "h-9 w-9 sm:h-10 sm:w-10";
  return (
    <div className={cn("relative flex shrink-0 items-center justify-center", box)}>
      <span className="absolute inset-0 rounded-full border border-emerald-400/40 bg-emerald-500/10" aria-hidden />
      <span
        className="absolute inset-1 animate-ping rounded-full border border-emerald-400/30 opacity-40"
        aria-hidden
      />
      <span className="absolute inset-2 rounded-full border border-red-500/25 bg-red-500/5" aria-hidden />
      <ShieldAlert
        className={cn(
          "relative z-10 text-emerald-300 drop-shadow-[0_0_14px_rgba(52,211,153,0.7)]",
          icon
        )}
        aria-hidden
      />
      <Radar
        className="absolute -bottom-0.5 -right-0.5 h-5 w-5 text-red-400/90 drop-shadow-[0_0_8px_rgba(248,113,113,0.55)] sm:h-6 sm:w-6"
        aria-hidden
      />
    </div>
  );
}

function BadgeList({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {SHIELD.badges.map((label, index) => (
        <li
          key={label}
          className={cn(
            "rounded-full border px-2.5 py-1.5 text-[10px] font-semibold leading-snug sm:text-xs",
            index === 0 && "border-emerald-500/35 bg-emerald-500/10 text-emerald-200/90",
            index === 1 && "border-slate-600 bg-slate-900/70 text-slate-200",
            index === 2 && "border-red-500/30 bg-red-500/10 text-red-200/90"
          )}
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

export function DarkWebSurveillanceShield({
  className,
  variant = "full"
}: DarkWebSurveillanceShieldProps) {
  if (variant === "scannerProminent") {
    return (
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-[#070b14] via-[#0c1222] to-emerald-950/30 p-4 shadow-[0_0_48px_rgba(16,185,129,0.18)] sm:p-6",
          className
        )}
        aria-labelledby="dark-web-surveillance-title"
      >
        <div
          className="pointer-events-none absolute -left-20 top-0 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          <div className="flex justify-center sm:justify-start">
            <ShieldIcon size="lg" />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300/95">{SHIELD.badge}</p>
            <h2
              id="dark-web-surveillance-title"
              className="mt-2 text-balance text-xl font-extrabold leading-snug tracking-tight text-white sm:text-2xl"
            >
              {SHIELD.title}
            </h2>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-slate-200 sm:text-base">{SHIELD.body}</p>
            <BadgeList className="mt-4 justify-center sm:justify-start" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-950 via-[#0c1222] to-emerald-950/25 shadow-[0_0_40px_rgba(16,185,129,0.12)] p-5 sm:p-7",
        className
      )}
      aria-labelledby="dark-web-surveillance-title"
    >
      <div
        className="pointer-events-none absolute -left-16 top-0 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-10 bottom-0 h-32 w-32 rounded-full bg-red-500/10 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex shrink-0 items-center justify-center sm:justify-start">
          <ShieldIcon />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-300/90">{SHIELD.badge}</p>
          <h2
            id="dark-web-surveillance-title"
            className="mt-2 text-lg font-bold leading-tight text-white sm:text-xl md:text-2xl"
          >
            {SHIELD.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">{SHIELD.body}</p>
          <BadgeList className="mt-4" />
        </div>
      </div>
    </section>
  );
}
