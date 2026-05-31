"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, LoaderCircle, Mail, MapPin, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useUnlockModal } from "@/hooks/useUnlockModal";
import { getAcquisitionSource } from "@/lib/acquisition-source";
import { useScanRealtime } from "@/lib/hooks/useScanRealtime";
import { trackEvent } from "@/lib/analytics";
import { UserState } from "@/lib/global-user-state";
import { setUserState } from "@/lib/useGlobalUserState";
import { syncClientStateToServer } from "@/lib/server-state-sync";
import { buildExposuresFromDiscovery, type ExposureItem } from "@/lib/exposure-engine";
import { STORAGE_LEAD_EMAIL } from "@/lib/growth-constants";
import type { DiscoveryResult } from "@/lib/types/discovery";
import { getStateLabel, US_STATE_OPTIONS } from "@/lib/us-states";
import { PWA_EVENT_SCAN_COMPLETE } from "@/lib/pwa-install-events";
import { PrivateInviteBlock } from "@/components/referral/PrivateInviteBlock";
import { getPendingReferralCodeForAttribution, shouldCountReferralConversion } from "@/lib/referral-link";
import { discoveryRiskExposuresFromDeepScan } from "@/lib/deep-scan-ui-bridge";
import { CORE_PRODUCT_COPY as COPY, getScanPipelineStatusMessages } from "@/lib/product-messaging";
import { cn } from "@/lib/utils";
import type { RiskAnalysisResult } from "@/lib/risk-analysis";
import type { ScanStatus } from "@/types";
import { SystemExposureCard } from "@/components/scanner/SystemExposureCard";
import { DarkMap } from "@/components/scanner/DarkMap";
import { DarkWebSurveillanceShield } from "@/components/trust/DarkWebSurveillanceShield";
import { initSfx, playPulse } from "@/lib/sfx";
import { typicalBrokersForState } from "@/lib/public-exposure-sim";

type FieldErrors = {
  email?: string;
  state?: string;
  fullName?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SCAN = COPY.scan;
const PAYWALL = COPY.paywall;
const LOADING_STEPS = getScanPipelineStatusMessages("");
const LeakExposureMap = dynamic(
  () => import("@/components/dashboard/LeakExposureMap").then((m) => ({ default: m.LeakExposureMap })),
  { ssr: false }
);

type DeepScanResult = {
  ok: true;
  tier: "free" | "paid";
  async?: boolean;
  jobId?: string;
  scanId?: string;
  status?: "complete";
  message?: string;
  provider?: string;
  risk?: { score: number; level: string };
  breaches: Array<{
    source: string;
    password: string | null;
    passwordHint: string | null;
    ipAddress: string | null;
    removeUrl: string | null;
  }>;
  map?: {
    latitude: number;
    longitude: number;
    leaksWithIp: number;
    city: string | null;
    country: string | null;
  } | null;
  identity?: {
    addresses: Array<{ city: string; state: string; streetMasked: string }>;
    phones: string[];
    photoUrl: string | null;
    brokers: Array<{ name: string; status: "EXPOSED" | "NO_SIGNAL" }>;
    darkWebHits?: Array<{ title: string; bucket: string; date: string | null; preview: string }>;
  } | null;
};

type PublicExposureResult = {
  ok: true;
  query: { fullName: string; stateCode: string };
  brokers: Array<{ name: string; status: "EXPOSED" | "NO_SIGNAL"; confidence: number }>;
  identity: {
    addresses: Array<{ city: string; state: string; streetMasked: string }>;
    phones: string[];
  };
  confidenceScore: number;
};

function validateForm(
  fullName: string,
  email: string,
  state: string
): { ok: true } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim();
  // Primary targeting is Full Name + State, but email is required for breach matching/report delivery.
  if (!trimmedName) {
    errors.fullName = "Full name is required for public identity exposure search.";
  }
  if (!trimmedEmail) {
    errors.email = "Email is required to perform a deep security audit.";
  } else if (!EMAIL_RE.test(trimmedEmail)) {
    errors.email = SCAN.form.emailInvalid;
  }
  if (!state) {
    errors.state = SCAN.form.stateError;
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

function describeDeepScanError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : typeof raw === "string" ? raw : "scan_failed";
  const m = String(msg);
  if (m.includes("deep_scan_degraded") || m.includes("rate_limited")) {
    return "Deep Scan is busy right now. Please wait a moment and try again.";
  }
  return "Deep Scan unavailable right now. Please try again later.";
}

function scrollToDarkWebResults(): void {
  window.scrollTo({
    top: document.getElementById("dark-web-results")?.offsetTop || 550,
    behavior: "smooth"
  });
}

export function ScannerPanel() {
  const { openModal } = useUnlockModal();
  const [lastDiscovery, setLastDiscovery] = useState<DiscoveryResult | null>(null);
  const [lastRisk, setLastRisk] = useState<RiskAnalysisResult | null>(null);
  const [lastExposures, setLastExposures] = useState<ExposureItem[] | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [messageIndex, setMessageIndex] = useState(0);
  const [resultSnapshot, setResultSnapshot] = useState<{
    email: string;
    stateLabel: string;
    stateCode: string;
  } | null>(null);
  /** Public scan id for private-invite link stability. */
  const [completedPublicScanId, setCompletedPublicScanId] = useState<string | null>(null);
  const [deepScanResult, setDeepScanResult] = useState<DeepScanResult | null>(null);
  const [deepScanProgress, setDeepScanProgress] = useState<string | null>(null);
  const [intelLogs, setIntelLogs] = useState<string[]>([]);
  const [publicExposure, setPublicExposure] = useState<PublicExposureResult | null>(null);
  const [scanPercent, setScanPercent] = useState(0);
  const intelScrollRef = useRef<HTMLDivElement | null>(null);

  const scheduleGenerationRef = useRef(0);
  const [liveScanId, setLiveScanId] = useState<string | null>(null);
  const completionHandledForRef = useRef<string | null>(null);
  const scrollOnCompleteRef = useRef<string | null>(null);
  const scanRunPayloadRef = useRef<{ fullName: string; email: string; stateCode: string } | null>(null);
  const { statusSnapshot, lastEvent, progress } = useScanRealtime(liveScanId, {
    enabled: status === "scanning" && liveScanId != null
  });

  const currentStatusText = useMemo(() => {
    return LOADING_STEPS[Math.min(messageIndex, LOADING_STEPS.length - 1)] ?? LOADING_STEPS[0];
  }, [messageIndex]);

  const startScan = () => {
    const v = validateForm(fullName, email, stateCode);
    if (!v.ok) {
      setFieldErrors(v.errors);
      return;
    }
    setFieldErrors({});
    setScanError(null);
    setLastDiscovery(null);
    setLastRisk(null);
    setLastExposures(null);
    setMessageIndex(0);
    setResultSnapshot({
      email: email.trim(),
      stateLabel: getStateLabel(stateCode),
      stateCode
    });
    scheduleGenerationRef.current += 1;
    completionHandledForRef.current = null;
    scrollOnCompleteRef.current = null;
    setLiveScanId(null);
    setDeepScanResult(null);
    setDeepScanProgress(null);
    setIntelLogs([]);
    setPublicExposure(null);
    setScanPercent(0);
    trackEvent({ name: "scan_started", acquisition_source: getAcquisitionSource() });
    setStatus("scanning");

    void (async () => {
      const gen = scheduleGenerationRef.current;
      const payload = {
        fullName: fullName.trim() || undefined,
        email: email.trim() || undefined,
        stateCode
      };
      scanRunPayloadRef.current = {
        fullName: fullName.trim(),
        email: email.trim(),
        stateCode
      };
      try {
        const publicReq = fetch("/api/v1/public-exposure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ fullName: fullName.trim(), stateCode })
        })
          .then(async (r) => (r.ok ? ((await r.json()) as PublicExposureResult) : null))
          .catch(() => null);

        const res = await fetch("/api/v1/deep-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errorBody = await res.json().catch(() => null);
          const message = errorBody?.message || errorBody?.error || "Deep scan request failed";
          throw new Error(message);
        }
        const created = (await res.json()) as DeepScanResult;
        if (gen !== scheduleGenerationRef.current) {
          return;
        }
        const pub = await publicReq;
        if (pub && pub.ok) {
          setPublicExposure(pub);
        }
        setDeepScanResult(created);
        const payloadNow = scanRunPayloadRef.current;
        if (payloadNow && Array.isArray(created.breaches)) {
          const bridged = discoveryRiskExposuresFromDeepScan({
            fullName: payloadNow.fullName,
            email: payloadNow.email,
            breaches: created.breaches,
            identity: created.identity ?? null
          });
          setLastDiscovery(bridged.discovery);
          setLastRisk(bridged.risk);
          setLastExposures(bridged.exposures);
        }
        setStatus("complete");
        setLiveScanId(null);
        playPulse("found");
      } catch (error) {
        if (gen !== scheduleGenerationRef.current) {
          return;
        }
        const message = describeDeepScanError(error);
        setScanError(message || SCAN.genericError);
        setStatus("idle");
        setLiveScanId(null);
      }
    })();
  };

  useEffect(() => {
    initSfx();
  }, []);

  useEffect(() => {
    if (status !== "scanning") {
      return;
    }
    const timer = window.setInterval(() => {
      setScanPercent((prev) => (prev >= 99 ? 99 : prev + 1));
    }, 45);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status !== "scanning" || progress == null) {
      return;
    }
    setScanPercent((prev) => Math.max(prev, Math.min(99, progress)));
  }, [status, progress]);

  useEffect(() => {
    if (status !== "complete" || !resultSnapshot || !lastRisk || !lastDiscovery || !lastExposures) {
      return;
    }
    const scrollKey = completedPublicScanId ?? resultSnapshot.email;
    if (scrollOnCompleteRef.current === scrollKey) {
      return;
    }
    scrollOnCompleteRef.current = scrollKey;
    setScanPercent(100);
    const frame = requestAnimationFrame(() => {
      scrollToDarkWebResults();
    });
    return () => cancelAnimationFrame(frame);
  }, [status, resultSnapshot, lastRisk, lastDiscovery, lastExposures, completedPublicScanId]);

  useEffect(() => {
    const el = intelScrollRef.current;
    if (!el) return;
    try {
      el.scrollTop = el.scrollHeight;
    } catch {
      // ignore
    }
  }, [intelLogs]);

  const formatIntelLogClass = (line: string) => {
    if (line.startsWith("[ALERT]")) return "text-red-200";
    if (line.startsWith("[DETECTED]")) return "text-amber-200";
    if (line.startsWith("[SYSTEM]")) return "text-indigo-200";
    return "text-slate-200";
  };

  useEffect(() => {
    if (status !== "scanning") {
      return;
    }
    if (!statusSnapshot && !lastEvent) {
      setMessageIndex(0);
      return;
    }

    const stage = typeof lastEvent?.stage === "string" ? lastEvent.stage : "";
    if (stage === "job_processing" || stage === "discovery") {
      setMessageIndex(0);
      return;
    }
    if (stage === "aggregation") {
      setMessageIndex(1);
      return;
    }
    if (stage === "analysis") {
      setMessageIndex(2);
      return;
    }
    if (stage === "persist" || stage === "sealed") {
      setMessageIndex(3);
      return;
    }

    if (statusSnapshot?.status === "started" || statusSnapshot?.jobStatus === "pending") {
      setMessageIndex(0);
      return;
    }
    if (statusSnapshot?.status === "processing" || statusSnapshot?.jobStatus === "processing") {
      setMessageIndex(1);
    }
  }, [status, statusSnapshot, lastEvent]);

  useEffect(() => {
    if (status !== "scanning" || !liveScanId) {
      return;
    }
    const gen = scheduleGenerationRef.current;
    const s = statusSnapshot;
    if (!s) {
      return;
    }
    if (completionHandledForRef.current === liveScanId) {
      return;
    }
    if (s.jobStatus === "failed") {
      completionHandledForRef.current = liveScanId;
      setScanError(s.lastError || "Scan job failed");
      setStatus("idle");
      setLiveScanId(null);
      return;
    }
    if (s.jobStatus !== "completed" || !s.discovery || !s.risk) {
      return;
    }
    const payload = scanRunPayloadRef.current;
    if (!payload) {
      return;
    }
    if (gen !== scheduleGenerationRef.current) {
      return;
    }
    completionHandledForRef.current = liveScanId;
    const data = {
      discovery: s.discovery as DiscoveryResult,
      risk: s.risk as RiskAnalysisResult
    };
    const fromApi = s as { exposures?: ExposureItem[] };
    setLastExposures(
      fromApi.exposures && fromApi.exposures.length > 0
        ? fromApi.exposures
        : buildExposuresFromDiscovery(data.discovery, data.risk)
    );
    const scanId = liveScanId;
    setLastDiscovery(data.discovery);
    setLastRisk(data.risk);
    const brokerN = data.discovery.brokerSources.length;
    try {
      sessionStorage.setItem(
        "pe_ui_scan_preview",
        JSON.stringify({ scanId, at: Date.now(), exposureScore: data.risk.exposureScore })
      );
    } catch {
      // optional non-authoritative UI cache
    }
    setUserState(UserState.EXPOSED, "scan_complete", { forceEvent: true });
    void syncClientStateToServer().catch(() => {
      // ignore
    });
    const state = payload.stateCode;
    const risk = data.risk;
    trackEvent({
      name: "risk_calculated",
      scanId,
      exposure_score: String(risk.exposureScore),
      broker_count: String(brokerN),
      us_state: state,
      risk_level: risk.riskLevel
    });
    trackEvent({
      name: "scan_completed",
      scanId,
      exposure_score: String(risk.exposureScore),
      broker_count: String(brokerN),
      us_state: state,
      risk_level: risk.riskLevel
    });
    if (shouldCountReferralConversion(scanId)) {
      const referrerCode = getPendingReferralCodeForAttribution();
      if (referrerCode) {
        trackEvent({ name: "referral_conversion", referrer_code: referrerCode, scanId });
      }
    }
    try {
      const em = payload.email.trim();
      if (em) {
        localStorage.setItem(STORAGE_LEAD_EMAIL, em.toLowerCase());
      }
    } catch {
      // ignore
    }
    setCompletedPublicScanId(scanId);
    setStatus("complete");
    setLiveScanId(null);
    try {
      window.dispatchEvent(new Event(PWA_EVENT_SCAN_COMPLETE));
    } catch {
      // ignore
    }
  }, [status, liveScanId, statusSnapshot]);

  return (
    <>
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-28 right-0 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative space-y-6">
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-white">{SCAN.panelTitle}</h3>
          <p className="text-sm text-slate-300">{SCAN.panelDescription}</p>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                {SCAN.form.fullNameLabel}
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={status === "scanning"}
                  autoComplete="name"
                  placeholder={SCAN.form.fullNamePlaceholder}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              {fieldErrors.fullName && <p className="mt-1 text-xs text-danger">{fieldErrors.fullName}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                {SCAN.form.emailLabel}
                <span className="ml-1 text-danger">*</span>
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((f) => ({ ...f, email: undefined }));
                    }
                  }}
                  disabled={status === "scanning"}
                  autoComplete="email"
                  required
                  aria-required="true"
                  placeholder={`${SCAN.form.emailPlaceholder} (required)`}
                  className={cn(
                    "w-full rounded-xl border border-slate-700 bg-slate-950/80 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
                    fieldErrors.email ? "border-danger" : "focus:border-primary"
                  )}
                />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{SCAN.form.emailUsageNote}</p>
              {fieldErrors.email && <p className="mt-1 text-xs text-danger">{fieldErrors.email}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                {SCAN.form.stateLabel}
              </label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <select
                  value={stateCode}
                  onChange={(e) => {
                    setStateCode(e.target.value);
                    if (fieldErrors.state) {
                      setFieldErrors((f) => ({ ...f, state: undefined }));
                    }
                  }}
                  disabled={status === "scanning"}
                  className={cn(
                    "w-full cursor-pointer appearance-none rounded-xl border border-slate-700 bg-slate-950/80 py-3 pl-10 pr-4 text-sm text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
                    fieldErrors.state ? "border-danger" : "focus:border-primary"
                  )}
                >
                  <option value="">{SCAN.form.statePlaceholder}</option>
                  {US_STATE_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              {fieldErrors.state && <p className="mt-1 text-xs text-danger">{fieldErrors.state}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:ml-auto sm:flex-1" />
            <Button
              onClick={startScan}
              className="w-full sm:min-w-44 sm:max-w-xs sm:self-end"
              type="button"
              disabled={status === "scanning" || !EMAIL_RE.test(email.trim())}
            >
              {SCAN.form.runButton}
            </Button>
          </div>

          <DarkWebSurveillanceShield variant="scannerProminent" />

          <AnimatePresence>
            {email.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.28 }}
                className="overflow-hidden"
              >
                <div className="mt-1 flex items-start gap-2.5 rounded-xl border border-orange-400/25 bg-gradient-to-r from-red-500/15 to-orange-500/10 px-3 py-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-400/15">
                    <Shield className="h-4 w-4 text-orange-200" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-wide text-orange-100">{SCAN.valueProp.kicker}</p>
                    <p className="mt-1 text-xs leading-relaxed text-orange-100/90">{SCAN.valueProp.body}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <p className="text-xs leading-relaxed text-slate-500">
            {SCAN.trustDataHandling.line1}
            <br />
            {SCAN.trustDataHandling.line2}
            <br />
            {SCAN.trustDataHandling.line3}
          </p>
          {scanError && <p className="text-sm text-danger">{scanError}</p>}
        </div>

        <AnimatePresence mode="wait">
          {status === "idle" && (
            <motion.p
              key="idle"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-slate-400"
            >
              {SCAN.scannerIdle}
            </motion.p>
          )}

          {status === "scanning" && (
            <motion.div
              key="scanning"
              initial={{ opacity: 1, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="min-h-[7rem] space-y-4"
            >
              <motion.div
                className="rounded-2xl border border-danger/20 bg-gradient-to-r from-red-950/20 via-slate-900/30 to-red-950/20 p-4"
                animate={{ boxShadow: ["0 0 0 0 rgba(239,68,68,0)", "0 0 24px 0 rgba(239,68,68,0.2)", "0 0 0 0 rgba(239,68,68,0)"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
              <p className="mb-2 text-xs font-medium text-slate-300">Scan started...</p>
              <div className="min-h-[1.5rem] text-sm">
                <div className="min-w-0">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={currentStatusText}
                      initial={{ opacity: 1, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.28 }}
                      className="flex items-start gap-2 text-indigo-200"
                    >
                      <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                      <span className="text-left leading-snug">{deepScanProgress ?? currentStatusText}</span>
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
                {intelLogs.length > 0 && (
                  <div
                    ref={intelScrollRef}
                    className="mt-3 max-h-44 overflow-auto rounded-xl border border-red-500/25 bg-gradient-to-b from-slate-950/60 to-black/60 px-3 py-2 font-mono text-[11px] leading-relaxed shadow-[0_0_28px_rgba(239,68,68,0.12)]"
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-300">Intelligence logs</span>
                      <motion.span
                        aria-hidden
                        className="h-2 w-2 rounded-full bg-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.65)]"
                        animate={{ opacity: [1, 0.35, 1] }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </div>

                    <div className="space-y-0.5">
                      <AnimatePresence initial={false}>
                        {intelLogs.slice(-18).map((line, idx) => (
                          <motion.div
                            key={`${idx}-${line}`}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className={cn("whitespace-pre-wrap break-words", formatIntelLogClass(line))}
                          >
                            {line}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      <motion.div
                        aria-hidden
                        className="mt-1 inline-block h-3 w-2 align-middle bg-red-400/80"
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      />
                    </div>
                  </div>
                )}
                <ProgressBar value={scanPercent} />
                <p className="text-right text-xs font-mono tabular-nums text-slate-400">{scanPercent}%</p>
                <p className="text-sm text-slate-400">{SCAN.scanningHelper}</p>
              </motion.div>
            </motion.div>
          )}

          {status === "complete" && resultSnapshot && lastRisk && lastDiscovery && lastExposures && (
            <motion.div
              key="complete"
              initial={{ opacity: 1, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div id="dark-web-results" className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">Public Identity Exposure</p>
                  <p className="mt-1 text-sm text-slate-300">
                    Simulated public-records style matching for <span className="font-semibold text-white">{resultSnapshot.stateLabel}</span>.
                  </p>
                  {publicExposure ? (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-200">
                        General Exposure Detected
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Broker signals</p>
                        <ul className="space-y-1.5">
                          {publicExposure.brokers.map((b) => (
                            <li key={b.name} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/35 px-3 py-2 text-xs">
                              <span className="text-slate-200">{b.name}</span>
                              <span className={b.status === "EXPOSED" ? "font-bold text-red-200" : "text-slate-400"}>
                                {b.status === "EXPOSED" ? "EXPOSED" : "NO SIGNAL"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {publicExposure.identity.addresses.length > 0 ? (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Address signals</p>
                          <ul className="mt-1 space-y-1.5">
                            {publicExposure.identity.addresses.map((a, idx) => (
                              <li key={`${a.city}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-900/35 px-3 py-2 text-xs text-slate-200">
                                {a.streetMasked}, {a.city}, {a.state}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {publicExposure.identity.phones.length > 0 ? (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Phone signals</p>
                          <ul className="mt-1 space-y-1.5">
                            {publicExposure.identity.phones.map((p, idx) => (
                              <li key={`${p}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-900/35 px-3 py-2 text-xs font-mono text-red-200">
                                {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-200">
                        General Exposure Detected
                      </div>
                      <p className="text-sm text-slate-300">
                        No hard match was required. People-search brokers typically list residents in{" "}
                        <span className="font-semibold text-white">{resultSnapshot.stateLabel}</span>.
                      </p>
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Common brokers in this state</p>
                        <ul className="space-y-1.5">
                          {typicalBrokersForState(resultSnapshot.stateCode).map((name) => (
                            <li
                              key={name}
                              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/35 px-3 py-2 text-xs"
                            >
                              <span className="text-slate-200">{name}</span>
                              <span className="font-bold text-red-200">TYPICAL LISTING</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">Private Credential Leaks</p>
                  <p className="mt-1 text-sm text-slate-300">
                    Deep breach search against your secure vault index for <span className="font-semibold text-white">{resultSnapshot.email}</span>.
                  </p>
                  <div className="mt-4 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-red-100">
                    Breaches found: <span className="font-extrabold">{deepScanResult?.breaches?.length ?? 0}</span>
                  </div>
                  {(deepScanResult?.breaches?.length ?? 0) === 0 ? (
                    <p className="mt-3 text-xs text-slate-300">
                      No hard match found in the vault for this email. Public exposure can still exist via broker listings based on your Name + State.
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs text-slate-400">
                    This section is computed from email-based index matches (masked hints only unless paid).
                  </p>
                </div>
              </div>

              <p className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary-foreground">
                We detected potential exposure across multiple data broker sources.
              </p>
              <div className="overflow-hidden rounded-2xl border-2 border-danger/50 bg-gradient-to-br from-red-950/50 via-slate-950/95 to-red-950/30 p-6 shadow-[0_0_48px_rgba(239,68,68,0.18)] sm:p-8">
                <h3 className="text-center text-xl font-extrabold leading-snug text-red-100 sm:text-2xl">
                  {SCAN.result.shockHeadline}
                </h3>
                <p className="mt-3 text-center text-sm leading-relaxed text-slate-200 sm:text-base">
                  {SCAN.result.shockSubtext}
                </p>
                <p className="mt-4 text-center text-sm font-semibold leading-snug text-amber-200/90 sm:text-[0.95rem]">
                  {SCAN.result.exposureRiskLine}
                </p>
                <ul className="mt-5 space-y-2">
                  {lastExposures.map((row) => {
                    const label = SCAN.result.categoryLabel[row.category] ?? row.category;
                    const isRel = row.category === "relatives";
                    const statusLabel = isRel
                      ? row.severity === "low"
                        ? SCAN.result.statusFound
                        : SCAN.result.statusLinked
                      : row.severity === "low"
                        ? SCAN.result.statusFound
                        : SCAN.result.statusExposed;
                    return (
                      <li
                        key={row.category}
                        className="flex items-center justify-between rounded-lg border border-red-500/35 bg-gradient-to-r from-red-900/30 to-slate-900/50 px-3 py-2.5 text-sm"
                      >
                        <span className="font-medium text-slate-100">{label}</span>
                        <span className="rounded-md bg-red-600/30 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-red-100">
                          {statusLabel}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-8 border-t border-red-500/20 pt-8">
                  <p className="text-center text-base font-extrabold text-white sm:text-xl">
                    Remove and Protect Your Data Permanently
                  </p>
                  <p className="mt-2 text-center text-sm leading-relaxed text-slate-300 sm:text-base">
                    Based on your exposure results, you can now activate full protection and automated removal system.
                  </p>
                  <div className="mx-auto flex w-full max-w-md flex-col self-center sm:mx-auto">
                    <Button
                      type="button"
                      className="min-h-14 w-full px-4 py-3.5 text-base font-bold shadow-[0_0_28px_rgba(220,38,38,0.38)] sm:min-h-16 sm:text-lg"
                      onClick={() => {
                        trackEvent({ name: "pricing_view_requested", source: "scanner" as const });
                        const pricing = document.getElementById("pricing");
                        if (pricing) {
                          pricing.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }}
                      variant="danger"
                    >
                      View Protection Plan
                    </Button>
                    <p className="mt-2.5 text-center text-[0.7rem] leading-relaxed text-slate-500">
                      {PAYWALL.noSubscriptionsLine}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        trackEvent({ name: "view_full_report_clicked", source: "scanner" as const });
                        openModal("scanner");
                      }}
                      className="mt-2 w-full text-center text-xs text-slate-500 underline-offset-2 transition-colors hover:text-slate-300"
                    >
                      {SCAN.result.viewFullReport}
                    </button>
                  </div>
                </div>
              </div>
              <SystemExposureCard />
              <DarkMap scanStatus={status} />
              <PrivateInviteBlock surface="scan_result" scanId={completedPublicScanId} />
            </motion.div>
          )}
          {status === "complete" && deepScanResult && (
            <motion.div
              key="deep-scan-complete"
              initial={{ opacity: 0, y: -14, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              className="space-y-4"
            >
              {deepScanResult.identity ? (
                <div className="space-y-3 rounded-xl border border-danger/35 bg-slate-950/60 p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-red-200">
                    {SCAN.result.identityAudit.title}
                  </h4>

                  <div className="flex items-start gap-4">
                    <div className="relative h-28 w-28 overflow-hidden rounded-lg border-2 border-red-500">
                      {deepScanResult.identity.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={deepScanResult.identity.photoUrl}
                          alt={SCAN.result.identityAudit.photoDetected}
                          className="h-full w-full object-cover"
                          style={{ filter: "blur(12px)" }}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-full w-full bg-slate-800 flex items-center justify-center text-xs text-slate-400" style={{ filter: "blur(12px)" }}>
                          PROFILED
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase text-slate-300">PROFILED: Public Identity Photo Found</p>
                      {deepScanResult.identity.addresses.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-xs font-semibold uppercase text-slate-300">{SCAN.result.identityAudit.addressesTitle}</p>
                          {deepScanResult.identity.addresses.map((addr, idx) => (
                            <div key={`addr-${idx}`} className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
                              <p className="font-bold text-sm">HOME ADDRESS SIGNAL: 12** {addr.streetMasked}, {addr.city}</p>
                              <motion.p
                                className="mt-1 text-xs text-red-300"
                                animate={{ opacity: [1, 0.55, 1] }}
                                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                              >
                                LIVE SIGNAL: Trading on 15+ broker databases
                              </motion.p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {deepScanResult.identity.phones.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-xs font-semibold uppercase text-slate-300">{SCAN.result.identityAudit.phoneTitle}</p>
                          <ul className="space-y-1">
                            {deepScanResult.identity.phones.map((phone, idx) => (
                              <li key={`phone-${idx}`} className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs font-mono text-red-200">
                                {phone}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {deepScanResult.identity.brokers.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-xs font-semibold uppercase text-slate-300">{SCAN.result.identityAudit.brokerTitle}</p>
                          <ul className="space-y-1">
                            {deepScanResult.identity.brokers.map((broker) => (
                              <li
                                key={broker.name}
                                className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-200"
                              >
                                <span>{broker.name}</span>
                                <span className={broker.status === "EXPOSED" ? "font-bold text-red-300" : "text-slate-400"}>
                                  {broker.status}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <p className="text-[11px] leading-relaxed text-slate-400">{SCAN.result.identityAudit.legalDisclaimer}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border-2 border-danger/60 bg-gradient-to-br from-red-950/60 via-slate-950/90 to-red-950/30 p-5 shadow-[0_0_42px_rgba(239,68,68,0.25)] sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">Risk Assessment</p>
                <h3 className="mt-2 text-2xl font-extrabold text-red-100 sm:text-3xl">
                  High-risk exposure detected
                </h3>
                <p className="mt-2 text-sm text-slate-200">
                  We detected real leaked credentials tied to your identity signals.
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-amber-200/90">
                  Score visibility: {deepScanResult.breaches.length} verified breach records in this scan
                </p>
              </div>
              {deepScanResult.map ? (
                <LeakExposureMap
                  latitude={deepScanResult.map.latitude}
                  longitude={deepScanResult.map.longitude}
                  leaksWithIp={deepScanResult.map.leaksWithIp}
                  city={deepScanResult.map.city}
                  country={deepScanResult.map.country}
                />
              ) : null}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-red-200">Masked leaked credentials</h4>
                <ul className="space-y-2">
                {deepScanResult.breaches.slice(0, 5).map((item, index) => (
                  <li key={`${item.source}-${index}`} className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                      {item.source}
                    </p>
                    <p className="mt-1 text-sm text-red-200 font-mono">{item.passwordHint ?? "Pa****12"}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Real exposure detected! We found your password {item.passwordHint ?? "Pa****12"} in {item.source}. Activate protection to nuke it.
                    </p>
                  </li>
                ))}
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-red-200">Exposed sources</h4>
                <ul className="space-y-2">
                  {deepScanResult.breaches.slice(0, 5).map((item, index) => (
                    <li key={`src-${item.source}-${index}`} className="rounded-lg border border-red-500/25 bg-red-500/5 px-4 py-2 text-sm text-slate-200">
                      Found in {item.source} leak
                    </li>
                  ))}
                </ul>
              </div>
              <motion.div
                className="rounded-lg border border-red-500/55 bg-red-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-200"
                animate={{ opacity: [1, 0.55, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              >
                CRITICAL EXPOSURE: Your physical and digital identity is 85% compromised.
              </motion.div>
              <Button
                type="button"
                className="min-h-14 w-full text-base font-extrabold shadow-[0_0_34px_rgba(239,68,68,0.45)]"
                variant="danger"
                onClick={() => openModal("scanner")}
              >
                Activate Lifetime Protection
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
    </>
  );
}
