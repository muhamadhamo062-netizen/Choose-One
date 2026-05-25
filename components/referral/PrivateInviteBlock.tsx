"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link2, Mail, MessageSquare } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";
import { buildReferralLandingUrl, getOrCreateOutgoingReferralCode } from "@/lib/referral-link";
import { cn } from "@/lib/utils";

const TEXT = COPY.privateInvite;

type PrivateInviteSurface = "scan_result" | "paywall";

type PrivateInviteBlockProps = {
  surface: PrivateInviteSurface;
  /** Latest completed scan public id, when available (improves stable PE- code). */
  scanId: string | null;
};

function buildShareLine(message: string, url: string): string {
  return `${message}\n\n${url}`;
}

export function PrivateInviteBlock({ surface, scanId }: PrivateInviteBlockProps) {
  const [refCode, setRefCode] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    const code = getOrCreateOutgoingReferralCode(scanId);
    setRefCode(code);
    if (code) {
      setShareUrl(buildReferralLandingUrl(code));
    }
  }, [scanId]);

  const fullBody = useMemo(() => buildShareLine(TEXT.message, shareUrl), [shareUrl]);

  useEffect(() => {
    if (!refCode || refCode.length < 6) {
      return;
    }
    try {
      const k = `pe_referral_panel_shown_${surface}`;
      if (window.sessionStorage.getItem(k) === "1") {
        return;
      }
      window.sessionStorage.setItem(k, "1");
    } catch {
      // ignore
    }
    trackEvent({ name: "referral_panel_viewed", surface });
  }, [surface, refCode]);

  const onCopy = useCallback(async () => {
    if (!shareUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      trackEvent({ name: "referral_link_copied", ref_code: refCode, surface });
    } catch {
      // ignore
    }
  }, [refCode, shareUrl, surface]);

  const onSms = useCallback(() => {
    const u = `sms:?body=${encodeURIComponent(fullBody)}`;
    try {
      window.open(u, "_self", "noopener,noreferrer");
    } catch {
      window.location.href = u;
    }
    trackEvent({ name: "referral_shared_sms", ref_code: refCode, surface });
  }, [refCode, surface, fullBody]);

  const onEmail = useCallback(() => {
    const q = new URLSearchParams();
    q.set("subject", TEXT.emailSubject);
    q.set("body", fullBody);
    const href = `mailto:?${q.toString()}`;
    try {
      window.open(href, "_self", "noopener,noreferrer");
    } catch {
      window.location.href = href;
    }
    trackEvent({ name: "referral_shared_email", ref_code: refCode, surface });
  }, [refCode, surface, fullBody]);

  if (!refCode || refCode.length < 6) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-600/50 bg-slate-950/40 p-4 shadow-inner",
        surface === "paywall" ? "mt-4" : "mt-1"
      )}
    >
      <h4 className="text-sm font-semibold text-slate-200">{TEXT.title}</h4>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{TEXT.message}</p>
      <p className="mt-1.5 text-[0.7rem] uppercase tracking-wide text-slate-500">{TEXT.helperLine}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-900/50 px-2 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/60"
        >
          <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {TEXT.ctaCopyLink}
        </button>
        <button
          type="button"
          onClick={onSms}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-900/50 px-2 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/60"
        >
          <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {TEXT.ctaSms}
        </button>
        <button
          type="button"
          onClick={onEmail}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-900/50 px-2 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/60"
        >
          <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {TEXT.ctaEmail}
        </button>
      </div>
    </div>
  );
}
