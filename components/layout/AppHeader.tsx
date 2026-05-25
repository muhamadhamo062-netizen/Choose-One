"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Shield } from "lucide-react";
import { PE_STATE_CHANGE } from "@/lib/global-user-state";
import { cn } from "@/lib/utils";

const AUTH_STATUS_URL = "/api/auth/status";
const AUTH_PROBE_MS = 4000;

async function probeAuthed(signal: AbortSignal): Promise<boolean> {
  const res = await fetch(AUTH_STATUS_URL, {
    credentials: "include",
    cache: "no-store",
    signal
  });
  const j = (await res.json().catch(() => null)) as { ok?: boolean; authed?: boolean } | null;
  return Boolean(res.ok && j?.ok === true && j.authed === true);
}

type AppHeaderProps = {
  /** From server layout (cookie + JWT) so Login/Dashboard paint on first HTML. */
  initialAuthed: boolean;
};

/**
 * Minimal: logo (product home) and sign-in as secondary. No nav that competes with the free scan.
 */
export function AppHeader({ initialAuthed }: AppHeaderProps) {
  const pathname = usePathname();
  const [hasUser, setHasUser] = useState(initialAuthed);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setHasUser(initialAuthed);
  }, [initialAuthed]);

  useEffect(() => {
    const ac = new AbortController();
    const timer = window.setTimeout(() => ac.abort(), AUTH_PROBE_MS);
    void probeAuthed(ac.signal)
      .then(setHasUser)
      .catch(() => {
        /* keep SSR hint on timeout/network error */
      })
      .finally(() => window.clearTimeout(timer));

    const sync = () => {
      const inner = new AbortController();
      const innerTimer = window.setTimeout(() => inner.abort(), AUTH_PROBE_MS);
      void probeAuthed(inner.signal)
        .then(setHasUser)
        .catch(() => {})
        .finally(() => window.clearTimeout(innerTimer));
    };

    window.addEventListener(PE_STATE_CHANGE, sync);
    return () => {
      ac.abort();
      window.clearTimeout(timer);
      window.removeEventListener(PE_STATE_CHANGE, sync);
    };
  }, [pathname]);

  const home = pathname === "/";
  const signOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      setHasUser(false);
      window.location.assign("/");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="section-container flex h-14 min-h-[3.5rem] items-center justify-between gap-3 sm:gap-6">
        <div className="flex min-w-0 shrink-0 items-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold tracking-tight text-white transition-opacity hover:opacity-90"
            aria-current={home ? "page" : undefined}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-primary/35">
              <Shield className="h-4 w-4 text-primary" aria-hidden />
            </span>
            <span>PrivacyEraser.ai</span>
          </Link>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
          {hasUser ? (
            <>
              <Link
                href="/dashboard"
                className={cn(
                  "inline-flex min-h-9 min-w-[5.5rem] items-center justify-center rounded-lg border border-primary/40 bg-primary/15 px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:border-primary/70 hover:bg-primary/20"
                )}
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={loggingOut}
                className={cn(
                  "inline-flex min-h-9 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-60"
                )}
              >
                <LogOut className="h-3.5 w-3.5" />
                {loggingOut ? "..." : "Logout"}
              </button>
            </>
          ) : (
            <Link
              href="/signup"
              className={cn(
                "inline-flex min-h-9 min-w-[5.5rem] items-center justify-center rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
              )}
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
