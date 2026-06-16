"use client";

import { motion } from "framer-motion";
import { Radar } from "lucide-react";
import { PrivacyEraserLogo } from "@/components/brand/PrivacyEraserLogo";
import { trackEvent } from "@/lib/analytics";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";
import { useGlobalUserState } from "@/lib/useGlobalUserState";

const pm = COPY.hero;

/**
 * Primary conversion: hero points to the anonymous state-level scanner (no account).
 */
export function HeroSection() {
  const { resolvedState } = useGlobalUserState();

  return (
    <section className="relative overflow-x-hidden overflow-y-visible pb-14 pt-12 sm:pt-16">
      <div className="absolute inset-0 -z-10 bg-grid-pattern bg-[size:32px_32px] opacity-20" />
      <div className="absolute inset-x-0 top-0 -z-10 h-52 bg-gradient-to-b from-blue-500/15 via-blue-500/5 to-transparent" />
      <div className="section-container">
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-5 flex justify-center">
            <div className="relative">
              <motion.span
                aria-hidden
                className="absolute -inset-3 rounded-2xl border border-indigo-400/35"
                animate={{ scale: [1, 1.2], opacity: [0.55, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
              />
              <PrivacyEraserLogo variant="mark" markSize={56} className="relative drop-shadow-[0_0_28px_rgba(99,102,241,0.45)]" />
              <Radar className="pointer-events-none absolute -right-1 -top-1 h-4 w-4 text-emerald-300/90" aria-hidden />
            </div>
          </div>
          <h1 className="text-balance text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl sm:leading-tight">
            {pm.headline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
            {pm.subtext}
          </p>
          <div className="mt-10 flex flex-col items-center gap-2">
            <a
              href="#scanner"
              onClick={() =>
                trackEvent({
                  name: "CTA_clicked_by_state",
                  cta: pm.primaryCta,
                  state: resolvedState,
                  surface: "hero"
                })
              }
              className="inline-flex min-h-12 min-w-[12rem] w-full max-w-md items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-blue-400 px-8 py-3.5 text-center text-base font-semibold text-white shadow-[0_0_28px_rgba(59,130,246,0.45)] transition-transform hover:scale-[1.015] hover:from-blue-400 hover:to-blue-300 sm:w-auto"
            >
              <motion.span
                animate={{ y: [0, -0.6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                {pm.primaryCta}
              </motion.span>
            </a>
            <a
              href="#how-it-works"
              onClick={() => trackEvent({ name: "hero_secondary_cta", surface: "hero" })}
              className="text-sm font-medium text-slate-500 underline-offset-2 transition-colors hover:text-slate-300 hover:underline"
            >
              {pm.secondaryCta}
            </a>
            <p className="text-sm font-medium text-slate-500">{pm.noCardFootnote}</p>
            <div className="mt-3 grid w-full max-w-xl gap-2 text-left sm:grid-cols-3 sm:text-center">
              {pm.trustLayer.map((line) => (
                <p key={line} className="rounded-lg border border-blue-500/15 bg-blue-500/5 px-3 py-2 text-xs text-slate-300">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
