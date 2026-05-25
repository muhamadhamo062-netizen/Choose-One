"use client";

import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { PaymentBrandRow } from "@/components/trust/payment/PaymentBrandRow";

export function SecureCheckoutBar() {
  return (
    <motion.div
      initial={{ opacity: 1, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0, margin: "0px 0px 180px 0px" }}
      transition={{ duration: 0.45 }}
      className="mx-auto mt-6 w-full max-w-sm"
    >
      <div className="relative overflow-hidden rounded-xl border border-slate-700/90 bg-slate-950/50 px-3 py-3.5 shadow-[0_0_0_1px_rgba(99,102,241,0.12),inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-primary/10 blur-2xl" />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-primary/10"
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative flex flex-col items-center gap-2.5">
          <PaymentBrandRow />
          <div className="flex items-center justify-center gap-1.5 text-center">
            <Lock className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
            <p className="text-[11px] font-medium leading-tight text-slate-400 sm:text-xs">
              Encrypted &amp; Secure Payment Processing
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
