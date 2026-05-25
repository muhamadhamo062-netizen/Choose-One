"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  STORAGE_CHECKOUT_EMAIL,
  STORAGE_LEAD_EMAIL,
  STORAGE_PENDING_REFERRAL
} from "@/lib/growth-constants";
import { getAcquisitionSource } from "@/lib/acquisition-source";
import { trackEvent } from "@/lib/analytics";
import { clearSignupPending, pushGlobalStateChange, setUserState, UserState } from "@/lib/global-user-state";
import { syncClientStateToServer } from "@/lib/server-state-sync";
import { useGlobalUserState } from "@/lib/useGlobalUserState";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";
import { getSupabaseDatabaseSettingsUrl } from "@/lib/supabase-dashboard-link";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Maps `/api/user/create` JSON `error` to a visible message (avoids a single generic failure line). */
function signupApiErrorMessage(error: string | undefined): string {
  switch (error) {
    case "email_in_use":
      return "That email is already registered";
    case "invalid_email":
    case "invalid_json":
      return "Enter a valid email";
    case "weak_password":
      return "Password must be at least 8 characters";
    case "temporary_unavailable":
      return "الخدمة مشغولة مؤقتًا. حاول مرة أخرى بعد ثوانٍ.";
    case "supabase_paste_required":
    case "database_not_configured":
      return "";
    case "create_failed":
      return "تعذر إنشاء الحساب الآن. حاول مرة أخرى خلال لحظات.";
    default:
      return "Could not create account";
  }
}

function isSupabaseEnvSetupError(error: string | undefined): boolean {
  return error === "supabase_paste_required" || error === "database_not_configured";
}

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedState } = useGlobalUserState();
  const from = searchParams.get("from");
  const fromPayment = from === "payment";
  const fromScan = from === "scan";
  const fromReferral = from === "referral";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  /** API `error` code for richer UI (e.g. Supabase .env setup). */
  const [errCode, setErrCode] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const supabaseDbSettingsUrl = getSupabaseDatabaseSettingsUrl();
  const [ready, setReady] = useState(false);
  const signupViewedOnce = useRef(false);

  useEffect(() => {
    if (signupViewedOnce.current) {
      return;
    }
    signupViewedOnce.current = true;
    trackEvent({ name: "signup_viewed", state: resolvedState, from: from || "direct" });
  }, [from, resolvedState]);

  useEffect(() => {
    let lead = "";
    try {
      if (fromPayment) {
        setUserState(UserState.SIGNUP_PENDING, "signup_visit_post_payment");
      } else if (fromScan) {
        setUserState(UserState.SIGNUP_PENDING, "signup_visit_from_scan");
      } else if (fromReferral) {
        setUserState(UserState.SIGNUP_PENDING, "signup_visit_from_referral");
      }
      lead =
        window.localStorage.getItem(STORAGE_CHECKOUT_EMAIL) || window.localStorage.getItem(STORAGE_LEAD_EMAIL) || "";
    } catch {
      // ignore
    }
    if (lead) {
      setEmail(lead);
    }
    setReady(true);
  }, [fromPayment, fromReferral, fromScan]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    setErrCode(null);
    if (!EMAIL_RE.test(email.trim())) {
      setErr("Enter a valid email");
      return;
    }
    if (password.length < 8) {
      setErr("Password must be at least 8 characters");
      return;
    }
    setPending(true);
    const raw = email.trim().toLowerCase();
    const refParam = (searchParams.get("ref") ?? "").trim().toUpperCase();
    let refRaw = refParam;
    if (!refRaw) {
      try {
        refRaw = (window.localStorage.getItem(STORAGE_PENDING_REFERRAL) ?? "").trim().toUpperCase();
      } catch {
        // ignore
      }
    }
    void (async () => {
      const tryLoginFallback = async () => {
        let loginRes: Response;
        try {
          loginRes = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email: raw, password })
          });
        } catch {
          return false;
        }
        const lj = (await loginRes.json().catch(() => ({}))) as {
          ok?: boolean;
          user?: { id: string; email: string; fullName?: string | null };
        };
        if (!loginRes.ok || lj.ok === false || !lj.user) {
          return false;
        }
        try {
          window.localStorage.setItem(STORAGE_LEAD_EMAIL, raw);
        } catch {
          // ignore
        }
        clearSignupPending("login_fallback_success");
        pushGlobalStateChange("post_login", true);
        void syncClientStateToServer().catch(() => {
          // ignore
        });
        router.push("/dashboard");
        return true;
      };

      let res: Response;
      try {
        res = await fetch("/api/user/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email: raw,
            password,
            fullName: raw.split("@")[0] || "Member",
            activateLifetime: fromPayment
          })
        });
      } catch {
        setErrCode(null);
        setErr("Could not reach the server. Start the app (npm run dev) and try again, or check your connection.");
        setPending(false);
        return;
      }
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        linkedScan?: boolean;
        scanId?: string;
        user?: { id: string; email: string };
      };
      if (j.error === "supabase_paste_required" || j.error === "database_not_configured") {
        setErrCode(j.error);
        setErr("");
        setPending(false);
        return;
      }
      if (!res.ok) {
        if (res.status === 409 && j.error === "email_in_use") {
          let loginRes: Response;
          try {
            loginRes = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ email: raw, password })
            });
          } catch {
            setErrCode(null);
            setErr("Could not reach the server. Check your connection and try again.");
            setPending(false);
            return;
          }
          const lj = (await loginRes.json().catch(() => ({}))) as {
            ok?: boolean;
            error?: string;
            reason?: string;
            message?: string;
            user?: { id: string; email: string; fullName?: string | null };
          };
          if (loginRes.ok && lj.ok !== false && lj.user) {
            try {
              window.localStorage.setItem(STORAGE_LEAD_EMAIL, raw);
            } catch {
              // ignore
            }
            clearSignupPending("login_success");
            pushGlobalStateChange("post_login", true);
            trackEvent({
              name: "login_completed",
              source: "signup_form_email_in_use",
              acquisition_source: getAcquisitionSource(),
              scanId: ""
            });
            void syncClientStateToServer().catch(() => {
              // ignore
            });
            setPending(false);
            window.setTimeout(() => {
              router.push("/dashboard");
            }, 200);
            return;
          }
          if (loginRes.ok && lj.ok === false) {
            setErrCode(lj.error ?? null);
            setErr(
              lj.error === "service_unavailable" || lj.reason === "database_unavailable"
                ? signupApiErrorMessage("temporary_unavailable")
                : lj.message ?? "Could not sign in. Try again in a moment."
            );
            setPending(false);
            return;
          }
          if (loginRes.status === 401) {
            setErrCode(null);
            setErr(
              "This email is already registered. Enter the password you used before to sign in on this device."
            );
            setPending(false);
            return;
          }
          if (loginRes.status === 503) {
            if (lj.reason === "supabase_paste_required" || lj.reason === "database_not_configured") {
              setErrCode(
                lj.reason === "database_not_configured" ? "database_not_configured" : "supabase_paste_required"
              );
              setErr("");
            } else {
              setErrCode(null);
              setErr(
                lj.reason === "database_unavailable"
                  ? signupApiErrorMessage("temporary_unavailable")
                  : "Service temporarily unavailable. Try again in a moment."
              );
            }
            setPending(false);
            return;
          }
          setErrCode(null);
          setErr("Could not sign in. Try again or reset your password if the product supports it.");
          setPending(false);
          return;
        }
        setErrCode(j.error ?? null);
        setErr(signupApiErrorMessage(j.error));
        setPending(false);
        return;
      }
      if (j.ok === false || !j.user) {
        if (j.error === "service_unavailable" || j.error === "temporary_unavailable" || j.error === "create_failed") {
          const loggedIn = await tryLoginFallback();
          if (loggedIn) {
            setPending(false);
            return;
          }
        }
        setErrCode(j.error ?? null);
        setErr(
          j.error === "service_unavailable"
            ? signupApiErrorMessage("temporary_unavailable")
            : signupApiErrorMessage(j.error)
        );
        setPending(false);
        return;
      }
      try {
        window.localStorage.setItem(STORAGE_LEAD_EMAIL, raw);
        if (refRaw.startsWith("PE-") && refRaw.length >= 6) {
          window.localStorage.removeItem(STORAGE_PENDING_REFERRAL);
        }
      } catch {
        // ignore
      }
      clearSignupPending("signup_success");
      if (fromPayment) {
        pushGlobalStateChange("post_signup_paid", true);
      } else {
        pushGlobalStateChange("post_signup_free");
      }
      const source = fromPayment ? "post_payment" : fromScan ? "scan" : "organic";
      trackEvent({
        name: "signup_completed",
        source,
        acquisition_source: getAcquisitionSource(),
        scanId: j.scanId ?? ""
      });
      void syncClientStateToServer().catch(() => {
        // ignore
      });
      setPending(false);
      window.setTimeout(() => {
        router.push("/dashboard");
      }, 200);
    })();
  };

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-800/50" />;
  }

  const headline = fromPayment
    ? "After checkout"
    : fromScan
      ? "After your scan"
      : fromReferral
        ? "Referral bonus"
        : "Create your account";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="p-5 sm:p-7">
        <p className="mb-0.5 text-center text-sm font-medium text-slate-500">{headline}</p>
        <form onSubmit={onSubmit} className="mt-4 space-y-3 sm:space-y-4" noValidate>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300" htmlFor="su-email">
              Email
            </label>
            <input
              id="su-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-11 rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              autoComplete="email"
              inputMode="email"
            />
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{COPY.scan.form.emailUsageNote}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300" htmlFor="su-pw">
              Password
            </label>
            <input
              id="su-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-11 rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              autoComplete="new-password"
            />
            <p className="mt-1.5 text-xs text-slate-500">At least 8 characters. Stored securely (bcrypt) on the server.</p>
          </div>
          {isSupabaseEnvSetupError(errCode ?? undefined) && (
            <div
              className="rounded-xl border border-amber-600/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100/95"
              role="alert"
            >
              <p className="font-medium text-amber-50">إعداد قاعدة البيانات (Supabase)</p>
              <p className="mt-2 leading-relaxed">
                من <strong>Settings → Database</strong>: انسخ <strong>Connection pooling → Transaction</strong> إلى{" "}
                <code className="rounded bg-black/30 px-1">DATABASE_URL</code> و<strong>Direct connection</strong> إلى{" "}
                <code className="rounded bg-black/30 px-1">DIRECT_URL</code> في <code className="rounded bg-black/30 px-1">.env.local</code>، احفظ، ثم شغّل{" "}
                <code className="rounded bg-black/30 px-1">npx prisma db push</code> ثم <code className="rounded bg-black/30 px-1">npm run dev</code>.
              </p>
              <p className="mt-2 text-xs text-amber-200/80">
                Paste <strong>Transaction</strong> + <strong>Direct</strong> into <code className="rounded bg-black/30 px-0.5">.env.local</code>, save, then{" "}
                <code className="rounded bg-black/30 px-0.5">npx prisma db push</code> and <code className="rounded bg-black/30 px-0.5">npm run dev</code>.
              </p>
              {supabaseDbSettingsUrl ? (
                <a
                  href={supabaseDbSettingsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/90"
                >
                  فتح صفحة Database / Open Database settings
                </a>
              ) : (
                <p className="mt-2 text-xs text-amber-200/70">
                  أضف <code className="rounded bg-black/30 px-0.5">NEXT_PUBLIC_SUPABASE_URL</code> في .env.local ليظهر الرابط مباشرة.
                </p>
              )}
            </div>
          )}
          {err && <p className="text-sm text-danger">{err}</p>}
          <Button type="submit" className="min-h-12 w-full text-base" disabled={pending} aria-busy={pending}>
            {pending ? "Securing your account…" : fromPayment || fromScan ? "Open dashboard" : "Create account"}
          </Button>
        </form>
      </Card>
    </motion.div>
  );
}
