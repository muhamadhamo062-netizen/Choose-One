"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
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
import { getLatestScanSession } from "@/lib/scan-session";
import { normalizeAuthEmail } from "@/lib/normalize-auth-email";

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
    case "database_unavailable":
      return "لا يوجد اتصال بقاعدة البيانات من Vercel. من Supabase انسخ DATABASE_URL و DIRECT_URL إلى Vercel ثم Redeploy، أو شغّل: node scripts/sync-vercel-env.cjs";
    case "temporary_unavailable":
    case "service_unavailable":
      return "الخدمة مشغولة مؤقتًا. حاول مرة أخرى بعد ثوانٍ.";
    case "session_not_configured":
      return "إعداد الجلسة ناقص على السيرفر. أضف SESSION_SECRET (32 حرفًا أو أكثر) في Vercel → Environment Variables.";
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

/** API may return `error: service_unavailable` with a specific `reason`. */
function apiErrKey(j: { error?: string; reason?: string }): string | undefined {
  if (j.reason) {
    return j.reason;
  }
  return j.error;
}

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedState } = useGlobalUserState();
  const from = searchParams.get("from");
  const fromPayment = from === "payment";
  const fromScan = from === "scan";
  const fromReferral = from === "referral";
  const setPasswordMode = searchParams.get("setPassword") === "1";
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
    const fromQuery = searchParams.get("email")?.trim() ?? "";
    if (fromQuery) {
      setEmail(normalizeAuthEmail(fromQuery));
    } else if (lead) {
      setEmail(normalizeAuthEmail(lead));
    }
    setReady(true);
  }, [fromPayment, fromReferral, fromScan, searchParams]);

  useEffect(() => {
    if (searchParams.get("signin") === "1") {
      router.replace("/login");
    }
  }, [router, searchParams]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    setErrCode(null);
    const raw = normalizeAuthEmail(email);
    if (!EMAIL_RE.test(raw)) {
      setErr("Enter a valid email");
      return;
    }
    if (password.length < 8) {
      setErr("Password must be at least 8 characters");
      return;
    }
    setPending(true);
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
      const finishSuccess = () => {
        try {
          window.localStorage.setItem(STORAGE_LEAD_EMAIL, raw);
          if (refRaw.startsWith("PE-") && refRaw.length >= 6) {
            window.localStorage.removeItem(STORAGE_PENDING_REFERRAL);
          }
        } catch {
          // ignore
        }
        clearSignupPending(setPasswordMode ? "set_password" : "signup_success");
        if (fromPayment) {
          pushGlobalStateChange("post_signup_paid", true);
        } else {
          pushGlobalStateChange("post_signup_free");
        }
        void syncClientStateToServer().catch(() => undefined);
        setPending(false);
        router.push("/dashboard");
      };

      let res: Response;
      const apiUrl = setPasswordMode ? "/api/auth/set-password" : "/api/user/create";
      const apiBody = setPasswordMode
        ? { email: raw, password }
        : {
            email: raw,
            password,
            fullName: raw.split("@")[0] || "Member",
            activateLifetime: fromPayment,
            scanId: getLatestScanSession()?.scanId?.trim() || undefined
          };
      try {
        res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(apiBody)
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
        reason?: string;
        linkedScan?: boolean;
        scanId?: string;
        user?: { id: string; email: string };
      };
      const errKey = apiErrKey(j);
      if (errKey === "supabase_paste_required" || errKey === "database_not_configured") {
        setErrCode(errKey);
        setErr("");
        setPending(false);
        return;
      }
      if (!res.ok) {
        if (setPasswordMode && res.status === 404) {
          setErr("لا يوجد حساب بهذا الإيميل. اعمل فحص أو ادفع أولاً، ثم اضبط كلمة المرور.");
          setPending(false);
          return;
        }
        if (res.status === 409 && j.error === "email_in_use") {
          setErrCode("email_in_use");
          setErr("This email already has an account. Sign in with your existing password.");
          setPending(false);
          return;
        }
        setErrCode(errKey ?? null);
        setErr(signupApiErrorMessage(errKey));
        setPending(false);
        return;
      }
      if (j.ok === false || !j.user) {
        setErrCode(errKey ?? null);
        setErr(signupApiErrorMessage(errKey));
        setPending(false);
        return;
      }
      const source = setPasswordMode
        ? "set_password"
        : fromPayment
          ? "post_payment"
          : fromScan
            ? "scan"
            : "organic";
      trackEvent({
        name: setPasswordMode ? "password_set" : "signup_completed",
        source,
        acquisition_source: getAcquisitionSource(),
        scanId: j.scanId ?? ""
      });
      finishSuccess();
    })();
  };

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-800/50" />;
  }

  const headline = setPasswordMode
    ? "Set your password"
    : fromPayment
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
        {setPasswordMode && (
          <p className="mt-2 text-center text-xs leading-relaxed text-slate-400">
            نفس إيميل الفحص أو الدفع. اختر كلمة مرور جديدة — تدخل الداشبورد مباشرة.
          </p>
        )}
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
              onBlur={() => setEmail((v) => normalizeAuthEmail(v))}
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
          {errCode === "email_in_use" && (
            <p className="text-sm text-slate-300">
              <Link href="/login" className="font-medium text-primary underline underline-offset-2">
                Sign in here
              </Link>{" "}
              instead of creating a new account.
            </p>
          )}
          <p className="text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary underline underline-offset-2">
              Sign in
            </Link>
          </p>
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
            {pending
              ? setPasswordMode
                ? "Saving…"
                : "Securing your account…"
              : setPasswordMode
                ? "Save password & open dashboard"
                : fromPayment || fromScan
                  ? "Open dashboard"
                  : "Create account"}
          </Button>
        </form>
      </Card>
    </motion.div>
  );
}
