"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/lib/analytics";
import { captureLeadEmail } from "@/lib/lead-capture";
import { SESSION_EXIT_INTENT_SHOWN } from "@/lib/growth-constants";
import { cn } from "@/lib/utils";

const TOP_THRESHOLD_PX = 24;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sessionAlreadyShown(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    return window.sessionStorage.getItem(SESSION_EXIT_INTENT_SHOWN) === "1";
  } catch {
    return true;
  }
}

function markSessionShown(): void {
  try {
    window.sessionStorage.setItem(SESSION_EXIT_INTENT_SHOWN, "1");
  } catch {
    // ignore
  }
}

export function ExitIntentModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fired = useRef(false);
  const labelId = useId();

  const tryOpen = useCallback(() => {
    if (fired.current || sessionAlreadyShown()) {
      return;
    }
    if (window.matchMedia("(max-width: 767px)").matches) {
      return;
    }
    fired.current = true;
    markSessionShown();
    setOpen(true);
    trackEvent({ name: "exit_intent_shown" });
  }, []);

  useEffect(() => {
    if (sessionAlreadyShown()) {
      return;
    }

    const onMouseMove = (e: MouseEvent) => {
      if (e.clientY < TOP_THRESHOLD_PX) {
        tryOpen();
      }
    };

    document.addEventListener("mousemove", onMouseMove, { passive: true } as AddEventListenerOptions);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
    };
  }, [tryOpen]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    const eNorm = email.trim();
    if (!EMAIL_RE.test(eNorm)) {
      setErr("Enter a valid email");
      return;
    }
    captureLeadEmail(eNorm, "exit_intent", { requestReport: true });
    trackEvent({ name: "exit_intent_submitted" });
    setSubmitted(true);
    setTimeout(() => {
      setOpen(false);
    }, 1500);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelId}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => {
              setOpen(false);
            }}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ type: "spring", duration: 0.45 }}
            className={cn(
              "relative w-full max-w-md rounded-2xl border border-danger/40",
              "bg-slate-900/95 p-6 shadow-[0_0_40px_rgba(239,68,68,0.12)]"
            )}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            {submitted ? (
              <p className="pr-8 text-sm text-accent">You&apos;re in—we&apos;ll email your exposure summary next.</p>
            ) : (
              <>
                <h2 id={labelId} className="pr-8 text-xl font-bold text-white sm:text-2xl">
                  You are still exposed on 100+ sites
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Criminal records, people-search sites, and broker APIs relist the same data in days. One free scan shows where
                  you show up.
                </p>
                <Button
                  type="button"
                  className="mt-4 w-full"
                  onClick={() => {
                    setOpen(false);
                    window.location.assign("/#scanner");
                  }}
                >
                  Check your exposure before you leave
                </Button>
                <p className="mt-4 text-center text-xs font-medium uppercase tracking-wide text-slate-500">Or get the report by email</p>
                <form onSubmit={onSubmit} className="mt-2 space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full rounded-xl border border-slate-600 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                    placeholder="you@email.com"
                  />
                  {err && <p className="text-xs text-danger">{err}</p>}
                  <Button type="submit" className="w-full" variant="outline">
                    Email me a summary
                  </Button>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
