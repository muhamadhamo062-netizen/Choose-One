"use client";

import { motion } from "framer-motion";
import { MapPin, Satellite } from "lucide-react";

export function SatellitePreviewPlaceholder() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.45 }}
      className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/60"
    >
      <div className="relative aspect-[21/9] w-full min-h-[120px] sm:aspect-[2.2/1]">
        <div
          className="absolute inset-0 bg-gradient-to-br from-slate-700/30 via-slate-900/80 to-indigo-950/60"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 50% at 30% 40%, rgba(99, 102, 241, 0.12), transparent), radial-gradient(ellipse 60% 40% at 70% 60%, rgba(34, 197, 94, 0.08), transparent)"
          }}
        />
        <div className="absolute inset-0 backdrop-blur-md" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-3 text-center">
          <Satellite className="h-5 w-5 text-primary/60" aria-hidden />
          <p className="text-xs font-medium text-slate-500">Satellite view available (PRO)</p>
        </div>
        <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-slate-950/60 px-2 py-0.5 text-[10px] text-slate-500">
          <MapPin className="h-3 w-3" aria-hidden />
          Preview locked
        </div>
      </div>
    </motion.div>
  );
}
