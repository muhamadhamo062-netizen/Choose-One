import type { Metadata } from "next";
import Link from "next/link";
import { Headphones, ShieldCheck } from "lucide-react";
import { SupportContactForm } from "@/components/support/SupportContactForm";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";

const S = COPY.supportCenter;

export const metadata: Metadata = {
  title: S.metaTitle,
  description: S.metaDescription
};

export default function SupportPage() {
  return (
    <main className="min-h-0 w-full flex-1 pb-24 pt-8 sm:pt-12">
      <div className="section-container max-w-6xl">
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900/90 via-slate-950 to-[#0c1222] p-8 shadow-2xl shadow-black/30 sm:p-10 lg:p-12">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
            aria-hidden
          />
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14 lg:items-start">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                {S.badge}
              </p>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{S.headline}</h1>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-400">{S.subhead}</p>
              <ul className="mt-8 space-y-3">
                {S.bullets.map((line) => (
                  <li key={line} className="flex gap-3 text-sm text-slate-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
              <div className="mt-10 rounded-xl border border-slate-700/60 bg-slate-950/50 p-5">
                <p className="flex items-start gap-3 text-sm text-slate-400">
                  <Headphones className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                  <span>
                    {S.faqTeaser}{" "}
                    <Link href="/faq" className="font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm">
                      {S.faqLinkLabel}
                    </Link>
                  </span>
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">{S.columnTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{S.columnHint}</p>
              <div className="mt-6">
                <SupportContactForm />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
