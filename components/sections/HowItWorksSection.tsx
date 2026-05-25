"use client";

import { ArrowRight, CheckCircle2, Radar, Search, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";

const HIW = COPY.howItWorks;
const STEP_ICONS = { scan: Radar, detect: Search, remove: Shield, verify: CheckCircle2 } as const;

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-t border-slate-800/60 py-16">
      <div className="section-container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">{HIW.title}</h2>
          <p className="mt-2 text-slate-400">{HIW.subtext}</p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {HIW.steps.map((s, i) => {
            const Icon = STEP_ICONS[s.id as keyof typeof STEP_ICONS];
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 1, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0, margin: "0px 0px 180px 0px" }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <Card className="relative h-full border border-slate-800 bg-slate-900/50 p-6">
                  {i < HIW.steps.length - 1 && (
                    <ArrowRight
                      className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-slate-600 md:block"
                      aria-hidden
                    />
                  )}
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-white">
                    {i + 1}. {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
