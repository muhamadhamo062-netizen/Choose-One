"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Check, Download, Link2, Twitter } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { downloadExposureShareCardPng } from "@/lib/share-card-canvas";
import { buildTwitterShareUrl, buildViralScanShareUrl } from "@/lib/viral-share-link";
import { cn } from "@/lib/utils";

type ScanShareCardProps = {
  exposureScore: number;
  brokerCount: number;
  riskLevel: string;
  className?: string;
};

export function ScanShareCard({ exposureScore, brokerCount, riskLevel, className }: ScanShareCardProps) {
  const [copyState, setCopyState] = useState<"idle" | "done" | "err">("idle");
  const [downloading, setDownloading] = useState(false);

  const onCopy = useCallback(() => {
    const url = buildViralScanShareUrl();
    void navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopyState("done");
        window.setTimeout(() => setCopyState("idle"), 2500);
      })
      .catch(() => {
        setCopyState("err");
        window.setTimeout(() => setCopyState("idle"), 3000);
      });
  }, []);

  const onPng = useCallback(() => {
    setDownloading(true);
    try {
      downloadExposureShareCardPng({
        score: exposureScore,
        brokers: brokerCount,
        risk: riskLevel
      });
    } finally {
      window.setTimeout(() => setDownloading(false), 500);
    }
  }, [exposureScore, brokerCount, riskLevel]);

  const onTwitter = useCallback(() => {
    const u = buildTwitterShareUrl(buildViralScanShareUrl());
    window.open(u, "_blank", "noopener,noreferrer");
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-5 shadow-lg",
        className
      )}
    >
      <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Share your results</p>
      <h3 className="mt-2 text-center text-lg font-extrabold text-white sm:text-xl">My Personal Data Exposure Report</h3>
      <ul className="mt-4 space-y-1.5 text-center text-sm text-slate-300">
        <li>
          Exposure score: <span className="font-bold text-red-200 tabular-nums">{exposureScore}%</span>
        </li>
        <li>
          Brokers found: <span className="font-bold text-slate-100 tabular-nums">{brokerCount}</span>
        </li>
        <li>
          Risk: <span className="font-bold text-red-300">{riskLevel}</span>
        </li>
      </ul>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1 sm:min-w-[8rem] sm:flex-none"
          onClick={onCopy}
        >
          {copyState === "done" ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Link2 className="mr-2 h-4 w-4" />
              {copyState === "err" ? "Copy failed" : "Copy link"}
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1 sm:min-w-[8rem] sm:flex-none"
          onClick={onPng}
          disabled={downloading}
          aria-busy={downloading}
        >
          <Download className="mr-2 h-4 w-4" />
          {downloading ? "…" : "Download PNG"}
        </Button>
        <Button
          type="button"
          className="min-h-11 flex-1 sm:min-w-[8rem] sm:flex-none"
          onClick={onTwitter}
        >
          <Twitter className="mr-2 h-4 w-4" />
          Share to Twitter
        </Button>
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">Friends open your link and run a free U.S. exposure check.</p>
    </motion.div>
  );
}
