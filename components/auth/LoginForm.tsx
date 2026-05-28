"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { STORAGE_CHECKOUT_EMAIL, STORAGE_LEAD_EMAIL } from "@/lib/growth-constants";
import { getAcquisitionSource } from "@/lib/acquisition-source";
import { trackEvent } from "@/lib/analytics";
import { clearSignupPending, pushGlobalStateChange } from "@/lib/global-user-state";
import { syncClientStateToServer } from "@/lib/server-state-sync";
import { useGlobalUserState } from "@/lib/useGlobalUserState";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";
import { normalizeAuthEmail } from "@/lib/normalize-auth-email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function apiErrKey(j: { error?: string; reason?: string }): string | undefined {
  return j.reason ?? j.error;
}

function loginErrorMessage(key: string | undefined, fallback?: string): string {
  switch (key) {
    case "database_unavailable":
      return "تعذر الاتصال بقاعدة البيانات. حاول بعد لحظات.";
    case "temporary_unavailable":
    case "service_unavailable":
      return "الخدمة مشغولة مؤقتًا. حاول مرة أخرى بعد ثوانٍ.";
    case "invalid_credentials":
      return "البريد أو كلمة المرور غير صحيحة.";
    case "password_not_set":
    case "paid_without_password":
      return "هذا الإيميل مربوط بدفع بدون كلمة مرور. من /signup أنشئ كلمة مرور لنفس الإيميل، أو تواصل مع الدعم.";
    case "wrong_password":
      return "كلمة المرور غير صحيحة. استخدم نفس كلمة المرور من أول تسجيل.";
    case "user_not_found":
      return "لا يوجد حساب بهذا الإيميل. أنشئ حسابًا من Sign up.";
    default:
      return fallback ?? "Could not sign in. Try again.";
  }
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedState } = useGlobalUserState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [showResetLink, setShowResetLink] = useState(false);
  const [pending, setPending] = useState(false);
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) {
      return;
    }
    viewed.current = true;
    trackEvent({ name: "login_viewed", state: resolvedState });
  }, [resolvedState]);

  useEffect(() => {
    try {
      const lead =
        window.localStorage.getItem(STORAGE_CHECKOUT_EMAIL) || window.localStorage.getItem(STORAGE_LEAD_EMAIL) || "";
      if (lead) {
        setEmail(normalizeAuthEmail(lead));
      }
    } catch {
      // ignore
    }
  }, []);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    setShowResetLink(false);
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
    void (async () => {
      let res: Response;
      try {
        res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: raw, password })
        });
      } catch {
        setErr("Could not reach the server. Check your connection and try again.");
        setPending(false);
        return;
      }
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        reason?: string;
        message?: string;
        canSetPassword?: boolean;
        user?: { id: string; email: string };
      };
      if (res.ok && j.ok === false && j.reason === "database_unavailable") {
        setErr(loginErrorMessage("database_unavailable", j.message));
        setPending(false);
        return;
      }
      const signedIn = res.status === 200 && Boolean(j.user) && !j.error && j.ok !== false;
      if (signedIn) {
        try {
          window.localStorage.setItem(STORAGE_LEAD_EMAIL, raw);
        } catch {
          // ignore
        }
        clearSignupPending("login_page");
        pushGlobalStateChange("post_login", true);
        trackEvent({
          name: "login_completed",
          source: "login_page",
          acquisition_source: getAcquisitionSource(),
          scanId: ""
        });
        void syncClientStateToServer().catch(() => undefined);
        const next = searchParams.get("next")?.trim();
        router.push(next && next.startsWith("/") ? next : "/dashboard");
        return;
      }
      const reason = j.reason ?? apiErrKey(j);
      setShowResetLink(
        Boolean(j.canSetPassword) ||
          reason === "wrong_password" ||
          reason === "paid_without_password" ||
          reason === "password_not_set"
      );
      setErr(loginErrorMessage(reason, j.message));
      setPending(false);
    })();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="p-5 sm:p-7">
        <p className="mb-0.5 text-center text-sm font-medium text-slate-500">Sign in</p>
        <form onSubmit={onSubmit} className="mt-4 space-y-3 sm:space-y-4" noValidate>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
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
            <label className="mb-1.5 block text-sm font-medium text-slate-300" htmlFor="login-pw">
              Password
            </label>
            <input
              id="login-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-11 rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              autoComplete="current-password"
            />
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
          {err && showResetLink && (
              <p className="text-sm text-slate-300">
                دفعت وما عندك كلمة مرور، أو نسيتها؟{" "}
                <Link
                  href={`/signup?setPassword=1&email=${encodeURIComponent(normalizeAuthEmail(email))}`}
                  className="font-medium text-primary underline underline-offset-2"
                >
                  اضبط كلمة مرور جديدة هنا
                </Link>
              </p>
            )}
          <Button type="submit" className="min-h-12 w-full text-base" disabled={pending} aria-busy={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-400">
          New here?{" "}
          <Link href="/signup" className="font-medium text-primary underline underline-offset-2">
            Create an account
          </Link>
        </p>
      </Card>
    </motion.div>
  );
}
