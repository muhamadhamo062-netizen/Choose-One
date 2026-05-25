"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ButtonVariant } from "@/types";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white shadow-glow hover:bg-indigo-500 focus-visible:ring-primary/60",
  outline:
    "border border-slate-600 bg-slate-900/40 text-slate-100 hover:border-primary hover:text-white focus-visible:ring-primary/40",
  danger: "bg-danger text-white hover:bg-red-500 focus-visible:ring-danger/50"
};

export function Button({
  className,
  variant = "primary",
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
