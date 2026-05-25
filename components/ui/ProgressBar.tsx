"use client";

import { motion } from "framer-motion";

interface ProgressBarProps {
  value?: number;
  indeterminate?: boolean;
}

export function ProgressBar({ value = 0, indeterminate = false }: ProgressBarProps) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
      {indeterminate ? (
        <motion.div
          className="h-full w-1/3 rounded-full bg-gradient-to-r from-primary to-accent"
          animate={{ x: ["-120%", "280%"] }}
          transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : (
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
          animate={{ width: `${value}%` }}
          transition={{ ease: "easeOut", duration: 0.45 }}
        />
      )}
    </div>
  );
}
