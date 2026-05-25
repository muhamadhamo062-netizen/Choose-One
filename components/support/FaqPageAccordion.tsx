"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";
import { cn } from "@/lib/utils";

const P = COPY.faqPage;

export function FaqPageAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {P.items.map((item, index) => {
        const open = openIndex === index;
        return (
          <div
            key={item.question}
            className="overflow-hidden rounded-xl border border-slate-700/90 bg-slate-950/40 shadow-lg shadow-black/15"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : index)}
              className={cn(
                "flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors",
                "hover:bg-slate-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              )}
              aria-expanded={open}
            >
              <span className="text-base font-semibold leading-snug text-white">{item.question}</span>
              <ChevronDown
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200",
                  open && "rotate-180 text-primary"
                )}
                aria-hidden
              />
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out",
                open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <p className="border-t border-slate-800/90 px-5 pb-5 pt-3 text-sm leading-relaxed text-slate-300">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
