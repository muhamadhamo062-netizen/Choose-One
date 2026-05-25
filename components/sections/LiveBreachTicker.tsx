"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { initSfx, playPulse } from "@/lib/sfx";

type Tick = { id: string; text: string; ts: number };

function makeSimTick(): Tick {
  const sources = ["SQL_Dump_Sector_7", "Combo_List_Partition_4", "Leak_Node_EU-2", "BrokerCache_US-NE", "IndexShard_118"];
  const events = ["New breach row indexed", "Credential pattern detected", "Exposure signal confirmed", "Broker listing matched", "Vault shard scanned"];
  const city = ["Dallas", "Miami", "Chicago", "Phoenix", "Seattle", "Boston", "Denver", "Atlanta"];
  const src = sources[Math.floor(Math.random() * sources.length)]!;
  const ev = events[Math.floor(Math.random() * events.length)]!;
  const c = city[Math.floor(Math.random() * city.length)]!;
  const id = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  return { id, ts: Date.now(), text: `[LIVE] ${ev} • ${src} • ${c}` };
}

export function LiveBreachTicker({ className }: { className?: string }) {
  // IMPORTANT: keep initial SSR + first client render deterministic to avoid hydration mismatch.
  // We'll populate randomized ticks after mount.
  const [ticks, setTicks] = useState<Tick[]>([]);

  useEffect(() => {
    initSfx();
    setTicks(Array.from({ length: 8 }).map(() => makeSimTick()));
    const t = window.setInterval(() => {
      setTicks((prev) => [...prev.slice(-18), makeSimTick()]);
      playPulse("tick");
    }, 1300);
    return () => window.clearInterval(t);
  }, []);

  const line = useMemo(() => {
    if (ticks.length === 0) return "[LIVE] Initializing ticker • Secure vault • Stand by";
    return ticks.map((t) => t.text).join("   •   ");
  }, [ticks]);

  return (
    <div className={cn("border-y border-red-500/15 bg-black/25", className)}>
      <div className="section-container py-3">
        <div className="flex items-center gap-3">
          <motion.span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full bg-red-500/80 shadow-[0_0_14px_rgba(239,68,68,0.65)]"
            animate={{ opacity: [1, 0.35, 1] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-red-300">Live breach ticker</p>
          <div className="min-w-0 flex-1 overflow-hidden">
            <motion.div
              className="whitespace-nowrap font-mono text-[11px] text-slate-200"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            >
              <span className="pr-10">{line}</span>
              <span className="pr-10">{line}</span>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

