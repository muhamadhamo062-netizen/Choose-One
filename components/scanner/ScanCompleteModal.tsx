"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/lib/analytics";
import { getLastEmittedState, setUserState, UserState } from "@/lib/global-user-state";
import { syncClientStateToServer } from "@/lib/server-state-sync";

type ScanCompleteModalProps = {
  open: boolean;
  onClose: () => void;
  resolvedState: UserState;
};

export function ScanCompleteModal({ open, onClose, resolvedState }: ScanCompleteModalProps) {
  const router = useRouter();

  const onContinueToReport = () => {
    const previous = getLastEmittedState();
    void syncClientStateToServer()
      .then(() => {
        setUserState(UserState.SIGNUP_PENDING, "full_report_modal_nav");
        trackEvent({
          name: "funnel_stage_entered",
          stage: UserState.SIGNUP_PENDING,
          previous,
          reason: "view_full_report_modal"
        });
        trackEvent({ name: "funnel_milestone", milestone: "scan_full_report_signup", state: resolvedState });
        onClose();
        router.push("/signup?from=scan");
      })
      .catch(() => {
        setUserState(UserState.SIGNUP_PENDING, "full_report_modal_nav");
        trackEvent({ name: "funnel_milestone", milestone: "scan_full_report_signup", state: resolvedState });
        onClose();
        router.push("/signup?from=scan");
      });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm"
            aria-label="Close"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-danger/50 bg-slate-900 p-6 shadow-[0_0_60px_rgba(239,68,68,0.25)]"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-danger/40 bg-danger/15 px-3 py-1 text-xs font-bold uppercase text-danger">
              <AlertTriangle className="h-3.5 w-3.5" />
              Full report locked
            </div>
            <h3 className="pr-8 text-2xl font-extrabold text-white">Your exposure is confirmed</h3>
            <p className="mt-2 text-slate-300">
              Open a free account to unlock the full line-by-line exposure report, broker targets, and your removal control
              center.
            </p>
            <div className="mt-6">
              <Button
                type="button"
                className="w-full min-h-12 min-w-[12rem] shadow-[0_0_24px_rgba(99,102,241,0.3)]"
                onClick={onContinueToReport}
              >
                Continue to full report
              </Button>
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">Takes about a minute. No card required to view your report.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
