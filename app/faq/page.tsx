import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FaqPageAccordion } from "@/components/support/FaqPageAccordion";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";

const P = COPY.faqPage;

export const metadata: Metadata = {
  title: P.metaTitle,
  description: P.metaDescription
};

export default function FaqPageRoute() {
  return (
    <main className="min-h-0 w-full flex-1 pb-24 pt-8 sm:pt-12">
      <div className="section-container max-w-3xl">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{P.kicker}</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{P.headline}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-400">{P.subhead}</p>
        </div>

        <div className="mt-12">
          <FaqPageAccordion />
        </div>

        <div className="mt-14 rounded-2xl border border-slate-700/80 bg-slate-950/50 p-8 text-center">
          <p className="text-sm font-medium text-slate-300">{P.supportPrompt}</p>
          <Link
            href="/support"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            {P.supportLinkLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </main>
  );
}
