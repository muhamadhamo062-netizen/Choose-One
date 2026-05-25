import { Fingerprint, Lock, Shield, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";

const IC = COPY.instantCredibility;
const TI = COPY.trustIndicators;

const ICONS = [Sparkles, Shield, Lock, Fingerprint] as const;

export function InstantCredibilityStrip({ variant = "full" }: { variant?: "full" | "compact" }) {
  if (variant === "compact") {
    return (
      <div
        className="mb-8 rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 sm:p-5"
        aria-label="How PrivacyEraser works at a glance"
      >
        <ul className="space-y-1.5 text-sm leading-snug text-slate-300">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
            {IC.line1}
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
            {IC.line2}
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
            {IC.line3}
          </li>
        </ul>
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TI.map((row) => (
            <li key={row.title} className="text-xs text-slate-500">
              <span className="font-medium text-slate-400">{row.title}:</span> {row.text}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section
      className="border-b border-slate-800/70 bg-slate-950/40 py-10 sm:py-12"
      aria-label="Trust and product scope"
    >
      <div className="section-container">
        <ul className="mx-auto max-w-2xl space-y-2 text-center text-base text-slate-200 sm:text-lg">
          <li>{IC.line1}</li>
          <li>{IC.line2}</li>
          <li>{IC.line3}</li>
        </ul>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TI.map((row, i) => {
            const Icon = ICONS[i] ?? Sparkles;
            return (
              <Card key={row.title} className="border-slate-800/80 bg-slate-900/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="text-sm font-semibold text-white">{row.title}</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">{row.text}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
