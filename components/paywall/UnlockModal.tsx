"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RefundGuaranteeCallout } from "@/components/trust/RefundGuaranteeCallout";
import { trackEvent } from "@/lib/analytics";
import {
  STORAGE_CHECKOUT_EMAIL,
  STORAGE_LEAD_EMAIL,
  STORAGE_PAYWALL_SOURCE,
  STORAGE_PLAN
} from "@/lib/growth-constants";
import { getScanAnalyticsDimensions } from "@/lib/scan-session";
import { clearCheckoutStarted, setUserState, UserState } from "@/lib/useGlobalUserState";
import { syncClientStateToServer } from "@/lib/server-state-sync";
import { PWA_EVENT_PAYWALL_VIEWED } from "@/lib/pwa-install-events";
import { getLatestScanSession } from "@/lib/scan-session";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";
import type { UnlockSource } from "@/hooks/useUnlockModal";

const PW = COPY.paywall;
const PADDLE_SCRIPT_SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";
const PADDLE_SCRIPT_ATTR = "data-pe-paddle-v2";

function getEnvMode(): "sandbox" | "production" {
  const mode = process.env.NEXT_PUBLIC_PADDLE_ENV;
  return mode === "production" ? "production" : "sandbox";
}

async function ensurePaddle(): Promise<NonNullable<Window["Paddle"]> | null> {
  if (typeof window === "undefined") return null;
  if (window.Paddle) return window.Paddle;

  const existing = document.querySelector(`script[${PADDLE_SCRIPT_ATTR}]`) as HTMLScriptElement | null;
  if (!existing) {
    const s = document.createElement("script");
    s.src = PADDLE_SCRIPT_SRC;
    s.async = true;
    s.setAttribute(PADDLE_SCRIPT_ATTR, "1");
    document.body.appendChild(s);
  }

  await new Promise<void>((resolve) => {
    const check = () => {
      if (window.Paddle) {
        resolve();
        return;
      }
      window.setTimeout(check, 60);
    };
    check();
  });
  return window.Paddle ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseCheckoutTransactionId(event: unknown): string | null {
  if (!event || typeof event !== "object") {
    return null;
  }
  const d = (event as { data?: unknown }).data;
  if (!d || typeof d !== "object") {
    return null;
  }
  const o = d as Record<string, unknown>;
  if (typeof o.transaction_id === "string") {
    return o.transaction_id;
  }
  if (typeof o.id === "string") {
    return o.id;
  }
  const t = o.transaction;
  if (t && typeof t === "object" && typeof (t as { id?: string }).id === "string") {
    return (t as { id: string }).id;
  }
  return null;
}

type PollResult =
  | { ok: true; user: { id: string; email: string; fullName: string | null } }
  | { ok: false; error: "not_configured" | "rejected" | "timeout" };

/**
 * Real entitlement is written by the Paddle webhook. Poll until the subscription row exists, then the session
 * route sets the cookie (200). No client-trusted success paths.
 */
async function pollSessionFromTransaction(transactionId: string): Promise<PollResult> {
  for (let i = 0; i < 40; i += 1) {
    const res = await fetch("/api/user/session-from-transaction", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId })
    });
    if (res.ok) {
      const body = (await res.json()) as { user?: { id: string; email: string; fullName: string | null } };
      if (body.user?.id && body.user?.email) {
        return { ok: true, user: body.user };
      }
      return { ok: false, error: "rejected" };
    }
    if (res.status === 503) {
      return { ok: false, error: "not_configured" };
    }
    if (res.status === 404) {
      await sleep(1500);
      continue;
    }
    return { ok: false, error: "rejected" };
  }
  return { ok: false, error: "timeout" };
}

interface UnlockModalProps {
  isOpen: boolean;
  source: UnlockSource;
  onClose: () => void;
}

export function UnlockModal({ isOpen, source, onClose }: UnlockModalProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const initializedRef = useRef(false);
  const latestSourceRef = useRef<UnlockSource>("scanner");

  useEffect(() => {
    latestSourceRef.current = source;
  }, [source]);

  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<{
    payment: { state: string };
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCheckoutError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void fetch("/api/health/integrations", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ payment: { state: string } }>)
      .then((j) => setIntegrations({ payment: j.payment }))
      .catch(() => setIntegrations(null));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setUserState(UserState.PAYWALL_INTERACTED, "unlock_modal_opened");
    trackEvent({ name: "paywall_opened", source });
    trackEvent({ name: "paywall_viewed", source });
    try {
      window.dispatchEvent(
        new CustomEvent(PWA_EVENT_PAYWALL_VIEWED, { detail: { source } })
      );
    } catch {
      // ignore
    }
  }, [isOpen, source]);

  const canCheckout = useMemo(() => {
    return Boolean(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN && process.env.NEXT_PUBLIC_PADDLE_PRICE_ID);
  }, []);

  const paymentSystemBlocked =
    integrations != null && integrations.payment.state !== "VERIFIED_ACTIVE";
  const canOpenCheckout = canCheckout && !paymentSystemBlocked;

  const handleCheckout = async () => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    const priceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID;
    if (!token || !priceId) return;

    setBusy(true);
    setUserState(UserState.CHECKOUT_STARTED, "paddle_checkout_start");
    trackEvent({ name: "paywall_cta_clicked", source });
    {
      const dims = getScanAnalyticsDimensions();
      trackEvent({ name: "payment_started", source, ...dims });
    }

    try {
      const paddle = await ensurePaddle();
      if (!paddle) return;

      paddle.Environment.set(getEnvMode());
      if (!initializedRef.current) {
        const fail = (reason: string) => {
          const eventSource = latestSourceRef.current;
          const dims = getScanAnalyticsDimensions();
          trackEvent({ name: "payment_failed", source: eventSource, reason, ...dims });
        };

        paddle.Initialize({
          token,
          eventCallback: (event) => {
            const name = (event as { name?: string }).name;
            if (
              name === "checkout.error" ||
              name === "checkout.payment.error" ||
              name === "checkout.payment.failed"
            ) {
              fail("checkout_error");
              setCheckoutError(
                "We couldn’t complete payment. If you were charged, contact support with your email — your access is issued after our server confirms the payment."
              );
              return;
            }

            if (name !== "checkout.completed") {
              return;
            }

            const eventSource = latestSourceRef.current;
            const transactionId = parseCheckoutTransactionId(event);
            if (!transactionId) {
              fail("no_transaction_id");
              setCheckoutError(
                "We couldn’t confirm the transaction. If payment went through, wait a moment and use Check status from your account email, or contact support."
              );
              return;
            }

            void (async () => {
              const dims = getScanAnalyticsDimensions();
              try {
                const result = await pollSessionFromTransaction(transactionId);
                if (result.ok) {
                  clearCheckoutStarted("payment_completed");
                  trackEvent({ name: "payment_completed", source: eventSource, ...dims });
                  trackEvent({ name: "plan_upgraded", source: eventSource });
                  try {
                    localStorage.setItem(STORAGE_PLAN, "lifetime");
                    localStorage.setItem(STORAGE_PAYWALL_SOURCE, eventSource);
                    localStorage.setItem(STORAGE_LEAD_EMAIL, result.user.email);
                    localStorage.setItem(STORAGE_CHECKOUT_EMAIL, result.user.email);
                  } catch {
                    // ignore
                  }
                  void syncClientStateToServer().catch(() => {
                    // ignore
                  });
                  onClose();
                  router.push("/dashboard");
                  return;
                }
                if (result.error === "not_configured") {
                  fail("payment_system_not_configured");
                  setCheckoutError("Payment system not active in production");
                  return;
                }
                if (result.error === "timeout") {
                  fail("webhook_fulfillment_timeout");
                  setCheckoutError(
                    "We haven’t received payment confirmation on our server yet. Your bank may have charged you — if so, try again in a few minutes or contact support. We never grant access until our server records your payment."
                  );
                  return;
                }
                fail("session_from_transaction_rejected");
                setCheckoutError("Could not start your session. Contact support if payment succeeded.");
              } catch {
                fail("poll_exception");
                setCheckoutError("Could not verify your payment. Please try again or contact support.");
              }
            })();
          }
        });
        initializedRef.current = true;
      }

      const email = localStorage.getItem(STORAGE_LEAD_EMAIL) ?? undefined;
      const openPayload: {
        items: { priceId: string; quantity: number }[];
        customer?: { email: string };
        customData?: { public_scan_id: string };
      } = {
        items: [{ priceId, quantity: 1 }],
        customer: email ? { email } : undefined
      };
      const ps = getLatestScanSession()?.scanId?.trim();
      if (ps) {
        openPayload.customData = { public_scan_id: ps };
      }
      paddle.Checkout.open(openPayload);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
            aria-label="Close"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.28 }}
            className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-900/95 p-6 shadow-[0_0_60px_rgba(16,185,129,0.12)]"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="pt-1 text-center">
              <h3 className="text-balance text-2xl font-bold leading-tight tracking-tight text-white sm:text-[1.65rem]">
                {PW.headline}
              </h3>
              <div className="mt-6">
                <p className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{PW.priceMain}</p>
                <p className="mt-1 text-lg font-semibold text-slate-200 sm:text-xl">{PW.priceOneTime}</p>
                <p className="mt-2 text-sm text-slate-400">{PW.noSubscriptionsLine}</p>
              </div>
            </div>
            {checkoutError ? (
              <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-200" role="alert">
                {checkoutError}
              </p>
            ) : null}
            <ul className="mt-6 space-y-2.5 text-left text-sm text-slate-200">
              {PW.valueStack.map((row) => (
                <li key={row.line} className="flex gap-2.5">
                  <span className="mt-0.5 shrink-0" aria-hidden>
                    <Check className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
                  </span>
                  <span>
                    {row.line}
                    {"detail" in row && row.detail ? (
                      <span className="mt-0.5 block text-xs leading-snug text-slate-400">({row.detail})</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500/90" />
              {PW.trustLine}
            </p>
            <div className="mt-5 space-y-3">
              <RefundGuaranteeCallout variant="modal" />
              <Button
                className="min-h-16 w-full text-lg font-bold shadow-[0_0_32px_rgba(16,185,129,0.25)]"
                onClick={handleCheckout}
                disabled={!canOpenCheckout || busy}
              >
                {busy ? PW.ctaLoading : PW.cta}
              </Button>
              <p className="mt-2.5 text-center text-[0.72rem] leading-relaxed text-slate-400">
                {PW.trustDataHandling.line1}
                <br />
                {PW.trustDataHandling.line2}
                <br />
                {PW.trustDataHandling.line3}
              </p>
              <Link
                href="/#how-it-works"
                className="mt-3 block w-full text-center text-xs text-slate-500 underline-offset-2 transition-colors hover:text-slate-300 hover:underline"
                onClick={() => {
                  trackEvent({ name: "view_full_report_clicked", source });
                  onClose();
                }}
              >
                {PW.viewDetails}
              </Link>
              {paymentSystemBlocked ? (
                <p className="mt-2 text-center text-xs text-danger" role="alert">
                  Payment system not active in production. Set `DATABASE_URL`, `PADDLE_WEBHOOK_SECRET`, and
                  point Paddle&apos;s webhook to <span className="whitespace-nowrap">/api/webhooks/paddle</span>.
                </p>
              ) : null}
              {!canCheckout && (
                <p className="mt-2 text-center text-xs text-danger">
                  Missing Paddle env vars: `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` / `NEXT_PUBLIC_PADDLE_PRICE_ID`
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
