"use client";

import { motion } from "framer-motion";
import { Headset } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";

const C = COPY.contact;

export function ContactResponseHighlight() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      <Card className="border border-accent/30 bg-gradient-to-b from-accent/10 to-slate-950/40 p-4 text-left shadow-[0_0_32px_rgba(34,197,94,0.08)] sm:p-6">
        <div className="flex gap-3">
          <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/30">
            <Headset className="h-4 w-4 text-accent" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-4 text-sm leading-relaxed text-slate-300">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{C.emailLabel}</p>
              <a
                href={`mailto:${C.emailAddress}`}
                className="mt-1 inline-block font-medium text-accent underline-offset-2 hover:underline"
              >
                {C.emailAddress}
              </a>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{C.responseTimeLabel}</p>
              <p className="mt-1 text-slate-200">{C.responseTimeBody}</p>
            </div>
            <p className="text-slate-400">{C.urgentNote}</p>
            <p className="pt-2 text-center text-slate-500">{C.divider}</p>
            <div className="text-center text-sm text-slate-400">
              <p className="font-medium text-slate-300">{C.signOffLine1}</p>
              <p className="mt-1 text-xs text-slate-500">{C.signOffLine2}</p>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
