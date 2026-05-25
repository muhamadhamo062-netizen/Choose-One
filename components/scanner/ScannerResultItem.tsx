"use client";

import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScannerFinding } from "@/types";

interface ScannerResultItemProps {
  finding: ScannerFinding;
  index: number;
  /** Red alert styling for critical exposure list */
  critical?: boolean;
  staggerDelay?: number;
}

export function ScannerResultItem({
  finding,
  index,
  critical = false,
  staggerDelay = 0.08
}: ScannerResultItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * staggerDelay, duration: 0.3 }}
      className={cn(
        "flex items-center justify-between rounded-lg border px-4 py-3",
        critical
          ? "border-danger/50 bg-red-950/20 shadow-[0_0_0_1px_rgba(239,68,68,0.12)]"
          : "border-slate-700 bg-slate-900/50"
      )}
    >
      <span className="text-sm text-slate-200">{finding.label}</span>
      <span className="flex items-center gap-2 text-xs font-semibold">
        {finding.detected ? (
          <>
            <AlertTriangle className="h-4 w-4 text-danger" />
            <span className="text-danger">Exposed</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 text-accent" />
            <span className="text-accent">Protected</span>
          </>
        )}
      </span>
    </motion.div>
  );
}
