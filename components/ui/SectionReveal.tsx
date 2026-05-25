"use client";

import { motion } from "framer-motion";

/**
 * Mobile Safari can fail to run IntersectionObserver in time, leaving
 * `initial={{ opacity: 0 }}` stuck until a scroll/refresh. Keep text visible,
 * only animate a light vertical shift. Generous `rootMargin` so sections
 * near the fold still count as "in view" on first paint.
 */
const REVEAL_VIEWPORT = { once: true, amount: 0 as const, margin: "0px 0px 180px 0px" };

interface SectionRevealProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionReveal({ children, className }: SectionRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 1, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={REVEAL_VIEWPORT}
      transition={{ duration: 0.4 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
