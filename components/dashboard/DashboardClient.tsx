"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  CircleDot,
  Headphones,
  Home,
  LogOut,
  Settings,
  Shield,
  Skull
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { useUnlockModal } from "@/hooks/useUnlockModal";
import { STORAGE_CHECKOUT_STARTED } from "@/lib/growth-constants";
import { getScanAnalyticsDimensions } from "@/lib/scan-session";
import { UserState, setUserState } from "@/lib/global-user-state";
import { reconcileState } from "@/lib/server-state-sync";
import { useGlobalUserState } from "@/lib/useGlobalUserState";
import { trackEvent } from "@/lib/analytics";
import { PWA_EVENT_DASHBOARD_VIEWED } from "@/lib/pwa-install-events";
import { useScanRealtime } from "@/lib/hooks/useScanRealtime";
import {
  CORE_PRODUCT_COPY as COPY,
  formatDashboardExposureExposedWithRisk,
  formatDashboardExposureSubFreeGeneric,
  formatDashboardExposureSubFreeNoScanOnFile,
  formatDashboardExposureSubFreeWithScan,
  formatDashboardFallbackExposed,
  formatDashboardFromLastScanScoreLine,
  formatDashboardGreeting,
  formatDashboardLoadingSub,
  formatDashboardNoScanNeutral,
  formatDashboardProtectedGeneric
} from "@/lib/product-messaging";
import { cn } from "@/lib/utils";
import type {
  DashboardSectionId,
  UserPlan,
  BrokerListStatus,
  DashboardBrokerRow
} from "@/types/funnel";
import type { UserSessionPayload } from "@/types/api-session";

const DBOARD = COPY.dashboard;
const L = DBOARD.labels;
const LeakExposureMap = dynamic(
  () => import("@/components/dashboard/LeakExposureMap").then((m) => ({ default: m.LeakExposureMap })),
  { ssr: false }
);
type DeepScanBreach = {
  source: string;
  username: string | null;
  email: string | null;
  password: string | null;
  passwordHint: string | null;
  breachDate: string | null;
  ipAddress: string | null;
  removeUrl: string | null;
};

type DeepScanPayload = {
  ok: true;
  tier: "free" | "paid";
  provider: string;
  risk: { score: number; level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" };
  breaches: DeepScanBreach[];
  map?: {
    ipAddress: string;
    leaksWithIp: number;
    latitude: number;
    longitude: number;
    city: string | null;
    country: string | null;
    usedFallbackIp: boolean;
  } | null;
};

const NAV: { id: DashboardSectionId; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: DBOARD.nav.overview, icon: Home },
  { id: "removal", label: DBOARD.nav.removal, icon: Activity },
  { id: "darkweb", label: DBOARD.nav.darkweb, icon: Skull },
  { id: "settings", label: DBOARD.nav.settings, icon: Settings }
];

const BROKER_NAMES = ["Spokeo", "Whitepages", "BeenVerified", "TruthFinder", "Intelius"] as const;

function brokerStatusForName(name: string, plan: UserPlan, index: number): BrokerListStatus {
  void name;
  void index;
  return plan === "free" ? "exposed" : "cleaning";
}

function buildBrokerRows(plan: UserPlan): DashboardBrokerRow[] {
  return BROKER_NAMES.map((name, i) => ({
    id: `b-${i}`,
    name,
    status: brokerStatusForName(name, plan, i)
  }));
}

function mapRemovalStatusToBrokerStatus(status: "pending" | "sent" | "verified" | "failed"): BrokerListStatus {
  if (status === "verified") {
    return "protected";
  }
  if (status === "pending" || status === "sent") {
    return "cleaning";
  }
  return "exposed";
}

function statusStyles(status: BrokerListStatus): { pill: string } {
  if (status === "exposed") {
    return { pill: "bg-danger/15 text-red-200 border-danger/40" };
  }
  if (status === "cleaning") {
    return { pill: "bg-amber-500/15 text-amber-200 border-amber-500/30" };
  }
  return { pill: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30" };
}

/** Activity list from server session only (no localStorage / simulated removal or monitoring). */
function buildLifetimeActivityMessages(plan: UserPlan, server: UserSessionPayload | null): string[] {
  if (plan !== "lifetime" || !server) {
    return [];
  }
  const T = COPY.dashboard.paid.activityTimeline;
  const lines: string[] = [];
  if (server.scan) {
    lines.push(T.scanCompletedBackground);
  }
  return lines.slice(0, 4);
}

const CAN_PADDLE =
  typeof process !== "undefined" && Boolean(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN && process.env.NEXT_PUBLIC_PADDLE_PRICE_ID);

export function DashboardClient() {
  const router = useRouter();
  const { openModal } = useUnlockModal();
  const { resolvedState } = useGlobalUserState();
  const dashboardViewOnce = useRef(false);
  const [section, setSection] = useState<DashboardSectionId>("overview");
  const [plan, setPlan] = useState<UserPlan>("free");
  const [firstName, setFirstName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [server, setServer] = useState<UserSessionPayload | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{
    scans: number;
    sourcesFound: number;
    removalsRequested: number;
    verifiedRemovals: number;
    pending: number;
    successRate: number;
    lastUpdated: string;
  } | null>(null);
  const [deepScan, setDeepScan] = useState<DeepScanPayload | null>(null);
  const [deepScanLoading, setDeepScanLoading] = useState(false);
  const [deepScanError, setDeepScanError] = useState<string | null>(null);

  const activeScan = useMemo(() => {
    if (!server?.scan) {
      return null;
    }
    return {
      scanId: server.scan.scanId,
      exposureScore: server.scan.exposureScore,
      brokersFound: server.scan.brokersFound,
      state: server.scan.state,
      riskLevel: server.scan.riskLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null | undefined
    };
  }, [server]);

  const brokers = useMemo((): (DashboardBrokerRow & { displayLabel: string })[] => {
    if (plan === "free") {
      return buildBrokerRows(plan).map((r) => ({ ...r, displayLabel: "EXPOSED" }));
    }
    const fromDb = server?.removalJobs ?? [];
    if (fromDb.length > 0) {
      return fromDb.map((job) => ({
        id: job.id,
        name: job.brokerName,
        status: mapRemovalStatusToBrokerStatus(job.status),
        displayLabel: job.status.toUpperCase()
      }));
    }
    const fromScan = server?.scan?.brokerSourceNames?.filter((s) => s.trim().length > 0) ?? [];
    const names = fromScan.length > 0 ? fromScan : [...BROKER_NAMES];
    return names.map((name, i) => ({
      id: `b-${i}`,
      name,
      status: "cleaning" as const,
      displayLabel: "PENDING"
    }));
  }, [plan, server]);

  const controlStatusLabel = useMemo(() => {
    if (!server) {
      return { text: "…", className: "border-slate-600 bg-slate-800/40 text-slate-300" };
    }
    if (plan === "lifetime") {
      if (server.dashboardState === "PROTECTED") {
        return { text: "PROTECTED", className: "border-emerald-500/50 bg-emerald-500/10 text-emerald-200" };
      }
      return { text: "EXPOSED", className: "border-danger/50 bg-danger/15 text-red-200" };
    }
    if (server.dashboardState === "NO_SCAN") {
      return { text: "NO SCAN", className: "border-slate-600 bg-slate-800/30 text-slate-200" };
    }
    if (server.dashboardState === "PROTECTED") {
      return { text: "PROTECTED", className: "border-emerald-500/50 bg-emerald-500/10 text-emerald-200" };
    }
    return { text: "EXPOSED", className: "border-danger/50 bg-danger/15 text-red-200" };
  }, [server, plan]);

  const refetchSession = useCallback(async () => {
    setSessionError(null);
    const res = await fetch("/api/user/session", { credentials: "include", cache: "no-store" });
    const raw = await res.json().catch(() => null);
    const data = raw as (UserSessionPayload & { ok?: boolean; error?: string; message?: string; emergencyAuth?: boolean }) | null;

    if (res.status === 401 || !data || data.ok === false) {
      if (res.ok && data && data.ok === false && (data.error === "session_data_unavailable" || data.error === "service_unavailable")) {
        setSessionError(data.message ?? DBOARD.systems.loadError);
        return;
      }
      let checkoutStarted = false;
      try {
        checkoutStarted = window.localStorage.getItem(STORAGE_CHECKOUT_STARTED) === "1";
      } catch {
        // ignore
      }
      if (checkoutStarted) {
        router.replace("/signup?from=payment");
      } else {
        router.replace("/signup");
      }
      return;
    }
    if (!res.ok) {
      setSessionError(DBOARD.systems.loadError);
      return;
    }
    if (!data.ok || !data.user) {
      setSessionError(DBOARD.systems.loadError);
      return;
    }
    const payload = data as UserSessionPayload;
    const emergencyAuth = data.emergencyAuth === true;
    const ent = payload.lifetimeEntitlement;
    const paid = ent && ent.status === "active" && ent.plan === "lifetime";
    if (!paid && !payload.scan && !emergencyAuth) {
      router.replace("/#scanner");
      return;
    }
    setServer(payload);
    setUserEmail(payload.user.email);
    setFirstName(payload.user.fullName?.split(" ")[0] ?? "there");
    setPlan(paid ? "lifetime" : "free");
    void reconcileState("dashboard_load").catch(() => {
      // non-authoritative: funnel flags
    });
  }, [router]);

  const refetchSessionRef = useRef(refetchSession);
  refetchSessionRef.current = refetchSession;
  useScanRealtime(server?.scan?.scanId ?? null, {
    enabled: Boolean(server?.scan?.scanId),
    onStreamEvent: (ev) => {
      if (ev.event === "scan_completed") {
        void refetchSessionRef.current();
      }
    }
  });

  useEffect(() => {
    void refetchSession();
  }, [refetchSession]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await fetch("/api/dashboard/metrics", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as {
        scans: number;
        sourcesFound: number;
        removalsRequested: number;
        verifiedRemovals: number;
        pending: number;
        successRate: number;
        lastUpdated: string;
      };
      if (!cancelled) {
        setMetrics(data);
      }
    };
    void load();
    const t = setInterval(() => {
      void load();
    }, 7000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!server?.user?.email) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      setDeepScanLoading(true);
      setDeepScanError(null);
      const res = await fetch("/api/v1/deep-scan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: server.user.email })
      });
      const raw = await res.json().catch(() => null);
      if (cancelled) {
        return;
      }
      if (res.status === 423 || raw?.error === "manual_scan_limit_reached") {
        const rem = raw?.scansRemaining as { remaining?: number; limit?: number } | undefined;
        setDeepScanError(
          rem
            ? `Manual deep scan limit reached (${rem.remaining ?? 0} of ${rem.limit ?? 5} remaining this cycle).`
            : "You have used all manual deep scans for this billing cycle."
        );
        setDeepScanLoading(false);
        return;
      }
      if (!res.ok || !raw || raw.ok !== true) {
        setDeepScanError("Deep scan unavailable right now.");
        setDeepScanLoading(false);
        return;
      }
      setDeepScan(raw as DeepScanPayload);
      setDeepScanLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [server?.user?.email]);

  const riskMeter = useMemo(() => {
    const score = deepScan?.risk.score ?? 0;
    if (score >= 85) {
      return { color: "bg-red-500", label: "Critical" };
    }
    if (score >= 60) {
      return { color: "bg-orange-500", label: "High" };
    }
    if (score >= 30) {
      return { color: "bg-amber-400", label: "Medium" };
    }
    return { color: "bg-emerald-500", label: "Low" };
  }, [deepScan?.risk.score]);

  useEffect(() => {
    if (dashboardViewOnce.current || !server) {
      return;
    }
    dashboardViewOnce.current = true;
    trackEvent({
      name: "dashboard_viewed",
      state: resolvedState,
      exposureScore: server.scan ? String(server.scan.exposureScore) : "0",
      scanId: server.scan?.scanId ?? ""
    });
    try {
      window.dispatchEvent(new Event(PWA_EVENT_DASHBOARD_VIEWED));
    } catch {
      // ignore
    }
  }, [resolvedState, server]);

  const onActivateLifetime = useCallback(() => {
    setUserState(UserState.PAYWALL_INTERACTED, "dashboard_lifetime_cta");
    const fromServer = server?.scan
      ? {
          exposure_score: String(server.scan.exposureScore),
          broker_count: String(server.scan.brokersFound),
          us_state: server.scan.state
        }
      : getScanAnalyticsDimensions();
    trackEvent({ name: "payment_started", source: "dashboard", ...fromServer });
    trackEvent({ name: "payment_clicked_from_dashboard", state: resolvedState });
    if (CAN_PADDLE) {
      openModal("dashboard");
    } else {
      window.location.assign("/#pricing");
    }
  }, [openModal, resolvedState, server]);

  const lifetimeActivityLines = useMemo(() => buildLifetimeActivityMessages(plan, server), [plan, server]);
  const autoRemoveEnabled = plan === "lifetime";

  const exposureLevel = useMemo(() => {
    if (!server) {
      return { label: L.loading, sub: formatDashboardLoadingSub(), color: "neutral" as const };
    }
    if (server.dashboardState === "PROTECTED") {
      return { label: L.protected, sub: formatDashboardProtectedGeneric(), color: "ok" as const };
    }
    if (plan === "free") {
      if (activeScan) {
        return {
          label: L.critical,
          sub: formatDashboardExposureSubFreeWithScan(activeScan.exposureScore, activeScan.brokersFound),
          color: "danger" as const
        };
      }
      if (server.dashboardState === "NO_SCAN") {
        return { label: L.critical, sub: formatDashboardExposureSubFreeNoScanOnFile(), color: "danger" as const };
      }
      return { label: L.critical, sub: formatDashboardExposureSubFreeGeneric(), color: "danger" as const };
    }
    if (server.dashboardState === "EXPOSED" && activeScan) {
      return {
        label: activeScan.riskLevel ?? L.exposed,
        sub: formatDashboardExposureExposedWithRisk(
          activeScan.riskLevel ?? L.exposed,
          activeScan.exposureScore,
          activeScan.brokersFound
        ),
        color: "danger" as const
      };
    }
    if (server.dashboardState === "EXPOSED" || server.dashboardState === "NO_SCAN") {
      if (activeScan) {
        return {
          label: L.exposed,
          sub: formatDashboardFromLastScanScoreLine(activeScan.exposureScore, activeScan.brokersFound),
          color: "danger" as const
        };
      }
      return { label: L.noScan, sub: formatDashboardNoScanNeutral(), color: "neutral" as const };
    }
    return { label: L.exposed, sub: formatDashboardFallbackExposed(), color: "warn" as const };
  }, [plan, activeScan, server]);

  const onSignOut = () => {
    void fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(() => {
      router.push("/");
    });
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col lg:flex-row">
      <aside className="border-b border-slate-800/80 bg-slate-950/50 lg:min-h-[50vh] lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 p-4 lg:block">
          <div className="flex items-center gap-2 text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
              <Shield className="h-4 w-4 text-primary" />
            </span>
            <span className="font-bold">Dashboard</span>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1 rounded-lg p-2 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-white lg:mt-4 lg:w-full lg:justify-start"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-2 lg:pb-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cn(
                  "flex min-w-[9rem] items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all lg:min-w-0",
                  active
                    ? "bg-primary/20 text-primary shadow-[inset_0_0_0_1px_rgba(99,102,241,0.3)]"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
          <Link
            href="/support"
            className={cn(
              "flex min-w-[9rem] items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all lg:min-w-0",
              "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            )}
          >
            <Headphones className="h-4 w-4 shrink-0" aria-hidden />
            {DBOARD.nav.support}
          </Link>
        </nav>
      </aside>

      <div className="min-h-0 flex-1 p-4 sm:p-6 lg:p-8">
        <header className="mb-8">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
              {DBOARD.pageTitle}
            </h1>
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide",
                controlStatusLabel.className
              )}
            >
              {controlStatusLabel.text}
            </span>
          </div>
          <p className="text-sm text-slate-400">
            {DBOARD.signedIn} {userEmail || "user"}
          </p>
        </header>

        {section === "overview" && (
          <div className="space-y-8">
            {metrics && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <Card className="p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Scans</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    <AnimatedNumber value={metrics.scans} />
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Sources found</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    <AnimatedNumber value={metrics.sourcesFound} />
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Removals verified</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    <AnimatedNumber value={metrics.verifiedRemovals} />
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Removals requested</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    <AnimatedNumber value={metrics.removalsRequested} />
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Pending verification</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    <AnimatedNumber value={metrics.pending} />
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Success rate</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    <AnimatedNumber value={Math.round(metrics.successRate)} />%
                  </p>
                </Card>
                <p className="sm:col-span-2 xl:col-span-6 text-xs text-slate-500">
                  Last updated from server: {new Date(metrics.lastUpdated).toLocaleTimeString()}
                </p>
              </div>
            )}
            {plan === "lifetime" && server && (
              <motion.div
                className="overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/50 via-slate-950/80 to-slate-900/60 p-5 sm:p-6"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white sm:text-xl">
                      {DBOARD.paid.protectionActive.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">
                      {DBOARD.paid.protectionActive.subtext}
                    </p>
                    <p className="mt-3 text-xs font-medium uppercase tracking-wide text-emerald-200/80">
                      {DBOARD.paid.labelLifetimeActive} · {DBOARD.paid.noFurtherAction}
                    </p>
                    <p className="mt-2 inline-flex rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
                      Auto-Remove: {autoRemoveEnabled ? "ON" : "OFF"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 sm:self-center">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </span>
                    <span className="text-sm font-semibold text-emerald-100">
                      {DBOARD.paid.protectionActive.liveLabel}
                    </span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden />
                  </div>
                </div>
              </motion.div>
            )}

            {plan === "lifetime" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Active Protection Progress</h3>
                <ol className="mt-4 space-y-3 text-sm">
                  <li className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <div>
                      <p className="font-semibold text-emerald-100">Step 1: Identity Verified</p>
                      <p className="text-xs text-emerald-200/80">Completed</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                    <Activity className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <div>
                      <p className="font-semibold text-amber-100">Step 2: Auto-removal requests sent to 100+ brokers</p>
                      <p className="text-xs text-amber-200/80">In Progress</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2.5">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
                    <div>
                      <p className="font-semibold text-indigo-100">Step 3: Continuous monitoring active</p>
                      <p className="text-xs text-indigo-200/80">Enabled</p>
                    </div>
                  </li>
                </ol>
              </div>
            )}

            {plan === "lifetime" && server && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                  <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-400">
                    <CircleDot className="h-4 w-4 text-primary" />
                    {DBOARD.paid.activityTimeline.sectionTitle}
                  </h3>
                  <ul className="mt-4 space-y-3 text-sm text-slate-200">
                    {lifetimeActivityLines.length > 0 ? (
                      lifetimeActivityLines.map((line) => (
                        <li key={line} className="flex gap-2.5">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/80" />
                          <span className="leading-relaxed">{line}</span>
                        </li>
                      ))
                    ) : (
                      <li className="flex gap-2.5 text-slate-500">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" />
                        {DBOARD.paid.protectionActive.subtext}
                      </li>
                    )}
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                    {DBOARD.paid.valueInAction.title}
                  </h3>
                  <ul className="mt-4 list-inside list-disc space-y-2 text-sm leading-relaxed text-slate-200 marker:text-emerald-500/80">
                    <li>{DBOARD.paid.valueInAction.line1}</li>
                    <li>{DBOARD.paid.valueInAction.line2}</li>
                    <li>{DBOARD.paid.valueInAction.line3}</li>
                  </ul>
                </div>
              </div>
            )}

            {plan === "lifetime" && server?.dashboardState === "PROTECTED" ? (
              <motion.div
                className="relative overflow-hidden rounded-2xl border border-emerald-500/35 bg-slate-900/50 p-8 text-center"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  {DBOARD.paid.cardLabel}
                </p>
                <p className="relative mt-3 text-3xl font-black tracking-tight text-emerald-100 sm:text-4xl">
                  {DBOARD.paid.statusTitle}
                </p>
                <p className="relative mt-2 text-lg font-semibold text-white">
                  {DBOARD.paid.labelLifetimeActive}
                </p>
                <p className="relative mt-3 text-sm font-medium text-emerald-200/90">{DBOARD.paid.headlineMonitored}</p>
                <p className="relative text-sm font-medium text-emerald-200/90">{DBOARD.paid.headlineRemovals}</p>
                <div className="relative mx-auto mt-6 max-w-lg space-y-3 text-left text-sm leading-relaxed text-slate-300">
                  <p className="font-semibold text-white">{DBOARD.paid.continuousProtection.lead}</p>
                  <p>{DBOARD.paid.continuousProtection.onceActivated}</p>
                  <p>{DBOARD.paid.continuousProtection.noManual}</p>
                  <p>{DBOARD.paid.continuousProtection.weHandle}</p>
                  <p>{DBOARD.paid.continuousProtection.periodicSummaries}</p>
                  <p className="pt-1 font-medium text-slate-200">
                    {DBOARD.paid.continuousProtection.notOneTime}
                    <br />
                    <span className="text-emerald-200/90">{DBOARD.paid.continuousProtection.continuousIdentity}</span>
                  </p>
                </div>
                {server.scansRemaining ? (
                  <p className="relative mt-6 rounded-lg border border-slate-700/80 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
                    Manual deep scans:{" "}
                    <strong className="text-white">
                      {server.scansRemaining.remaining} of {server.scansRemaining.limit}
                    </strong>{" "}
                    remaining this billing cycle.
                  </p>
                ) : null}
                <div className="relative mx-auto mt-8 max-w-md space-y-3 border-t border-slate-800/90 pt-6 text-left text-sm text-slate-300">
                  <p>
                    <span className="font-semibold text-slate-200">{DBOARD.paid.continuousMonitoring} </span>
                    {DBOARD.paid.continuousMonitoringValue}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-200">{DBOARD.paid.removalStatus} </span>
                    {DBOARD.paid.removalStatusValue}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  {DBOARD.free.cardLabel}
                </p>
                {plan === "free" && activeScan && (
                  <p className="relative mt-2 text-sm font-bold text-red-200">{DBOARD.freeHeroLine}</p>
                )}
                <div className="relative mx-auto mt-3 max-w-md">
                  {exposureLevel.color === "danger" && (
                    <motion.div
                      className="pointer-events-none absolute inset-0 -m-4 rounded-3xl bg-danger/20 blur-2xl"
                      animate={{ opacity: [0.4, 0.8, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                  <p
                    className={cn(
                      "relative text-3xl font-black tracking-tight sm:text-4xl",
                      exposureLevel.color === "danger" && "text-red-100 drop-shadow-[0_0_24px_rgba(239,68,68,0.45)]",
                      exposureLevel.color === "neutral" && "text-slate-200"
                    )}
                  >
                    {plan === "free" && exposureLevel.color === "danger"
                    ? DBOARD.free.exposureLevelPrefix
                    : ""}
                    {exposureLevel.label}
                  </p>
                  <p className="relative mt-2 text-sm text-slate-400">
                    {exposureLevel.sub}
                  </p>
                  {plan === "free" && !activeScan && (
                    <p className="relative mt-6 text-base font-medium text-slate-400">
                    {DBOARD.free.runScanHint}
                  </p>
                  )}
                </div>
              </motion.div>
            )}

            {plan === "free" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center"
              >
                <Button
                  type="button"
                  onClick={onActivateLifetime}
                  className="min-h-14 min-w-[min(100%,20rem)] px-10 text-base shadow-[0_0_40px_rgba(239,68,68,0.35)]"
                  variant="danger"
                >
                  {DBOARD.free.activateCta}
                </Button>
              </motion.div>
            )}

            {deepScan?.breaches.length ? (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-red-200">Red Alert: Real leaked credentials detected</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {deepScan.breaches
                    .filter((item) => Boolean(item.passwordHint))
                    .slice(0, 4)
                    .map((item, idx) => (
                      <Card key={`${item.source}-${idx}`} className="border border-danger/50 bg-danger/10 p-4">
                        <p className="text-xs uppercase tracking-wide text-red-200">{item.source}</p>
                        <p className="mt-1 text-sm text-slate-200">
                          Password preview: <span className="font-mono">{item.passwordHint}</span>
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          {plan === "free"
                            ? "Upgrade to reveal full compromised credential details."
                            : "Full password visibility and removal links are active on paid tier."}
                        </p>
                      </Card>
                    ))}
                </div>
              </div>
            ) : null}

            <p className="text-sm text-slate-400">
              {formatDashboardGreeting(plan === "free", firstName)}
            </p>

            <div>
              <h2 className="text-lg font-bold text-white">{DBOARD.free.brokerFeedTitle}</h2>
              <p className="mb-3 text-sm text-slate-500">
                {plan === "free"
                  ? DBOARD.free.brokerFeedLocked
                  : `${DBOARD.paid.brokerFeedPaid} — ${DBOARD.paid.monitoringNotScheduled} (N/A = not stored on server).`}
              </p>
              <ul className="space-y-2">
                {brokers.map((b, i) => {
                  const st = statusStyles(b.status);
                  const bl = "displayLabel" in b ? b.displayLabel : "—";
                  return (
                    <motion.li
                      key={b.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 * i }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
                        <span className="font-medium text-slate-200">{b.name}</span>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", st.pill)}
                          >
                            {bl}
                          </span>
                          {plan === "free" && (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                              {DBOARD.brokerRowLocked}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            </div>

          </div>
        )}

        <AnimatePresence mode="wait">
          {section === "removal" && (
            <motion.div
              key="rem"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Card className="p-5">
                <h2 className="text-lg font-bold text-white">
                  {plan === "lifetime" ? DBOARD.removalSectionLifetime.title : DBOARD.removalSection.title}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  {plan === "lifetime" ? (
                    DBOARD.removalSectionLifetime.body
                  ) : (
                    <>
                      {DBOARD.removalSection.lineBefore}
                      <span className="text-red-300">{DBOARD.removalSection.lineHighlight}</span>
                      {DBOARD.removalSection.lineAfter}
                    </>
                  )}
                </p>
              </Card>
            </motion.div>
          )}
          {section === "darkweb" && (
            <motion.div
              key="dw"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Card className="p-5">
                <h2 className="text-lg font-bold text-white">{DBOARD.darkwebSection.title}</h2>
                <p className="mt-2 text-sm text-slate-400">{DBOARD.darkwebSection.body}</p>
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-200">{DBOARD.darkwebSection.riskMeterLabel}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      {deepScan ? `${deepScan.risk.level} (${deepScan.risk.score}/100)` : "Not available"}
                    </p>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={cn("h-full transition-all", riskMeter.color)}
                      style={{ width: `${Math.max(6, deepScan?.risk.score ?? 0)}%` }}
                    />
                  </div>
                </div>
                {deepScan?.map && deepScan.breaches.length > 0 ? (
                  <div className="mt-4">
                    <LeakExposureMap
                      latitude={deepScan.map.latitude}
                      longitude={deepScan.map.longitude}
                      leaksWithIp={deepScan.map.leaksWithIp}
                      city={deepScan.map.city}
                      country={deepScan.map.country}
                    />
                  </div>
                ) : null}
                {deepScanLoading && <p className="mt-3 text-xs text-slate-400">Running deep scan...</p>}
                {deepScanError && <p className="mt-3 text-xs text-red-300">{deepScanError}</p>}
                {deepScan?.breaches?.length ? (
                  <ul className="mt-4 space-y-2">
                    {deepScan.breaches.slice(0, 6).map((entry, idx) => (
                      <li key={`${entry.source}-${idx}`} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                        <p className="text-sm font-medium text-slate-200">{entry.source}</p>
                        <p className="mt-1 text-xs text-slate-400">Password hint: {entry.passwordHint ?? "N/A"}</p>
                        {plan === "lifetime" && entry.removeUrl ? (
                          <a
                            href={entry.removeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs text-primary hover:underline"
                          >
                            Open removal link
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            </motion.div>
          )}
          {section === "settings" && (
            <motion.div
              key="st"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Card className="p-5">
                <h2 className="text-lg font-bold text-white">{DBOARD.settingsSection.title}</h2>
                <p className="text-sm text-slate-300">
                  {DBOARD.settingsSection.name} {server?.user?.fullName ?? "—"}
                </p>
                <p className="text-sm text-slate-300">
                  {DBOARD.settingsSection.email} {userEmail || "—"}
                </p>
                <p className="mt-2 text-xs text-slate-500">{DBOARD.systems.sessionNote}</p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
