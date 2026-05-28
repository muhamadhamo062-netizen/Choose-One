"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SecureCheckoutBar } from "@/components/trust/SecureCheckoutBar";
import { useUnlockModal } from "@/hooks/useUnlockModal";
import { trackEvent } from "@/lib/analytics";
import { UserState, setUserState } from "@/lib/useGlobalUserState";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";

const PR = COPY.paywall;

const PADDLE_VENDOR_SCRIPT = "https://cdn.paddle.com/paddle/paddle.js";
const SCRIPT_DATA_ATTR = "data-paddle-loader";

function usePaddleScript(): void {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    if (document.querySelector(`script[${SCRIPT_DATA_ATTR}]`)) {
      return;
    }
    const s = document.createElement("script");
    s.src = PADDLE_VENDOR_SCRIPT;
    s.async = true;
    s.setAttribute(SCRIPT_DATA_ATTR, "1");
    document.body.appendChild(s);
  }, []);
}

export function PricingSection() {
  const { openModal } = useUnlockModal();
  usePaddleScript();
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const key = "pe_lifetime_offer_deadline";
    const now = Date.now();
    let target = Number(window.localStorage.getItem(key) || 0);
    if (!target || Number.isNaN(target) || target <= now) {
      target = now + 24 * 60 * 60 * 1000;
      window.localStorage.setItem(key, String(target));
    }
    setDeadlineMs(target);
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const countdown = useMemo(() => {
    if (!deadlineMs) {
      return "24:00:00";
    }
    const remaining = Math.max(0, deadlineMs - nowTick);
    const h = Math.floor(remaining / (1000 * 60 * 60))
      .toString()
      .padStart(2, "0");
    const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
      .toString()
      .padStart(2, "0");
    const s = Math.floor((remaining % (1000 * 60)) / 1000)
      .toString()
      .padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [deadlineMs, nowTick]);

  const onCta = () => {
    setUserState(UserState.PAYWALL_INTERACTED, "pricing_section_cta");
    trackEvent({ name: "paywall_cta_clicked", source: "scanner" });
    openModal("scanner");
  };

  return (
    <section id="pricing" className="scroll-mt-20 py-14">
      <div className="section-container">
        <SectionReveal>
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">Disrupting the subscription racket</h2>
            <p className="mt-2 text-slate-300">
              Competitors charge <span className="font-bold text-white">$300/year</span>. We run the same mission for{" "}
              <span className="font-bold text-white">$149 Lifetime</span>.
            </p>
          </div>
          <Card className="relative mx-auto max-w-lg overflow-hidden border border-primary/35">
            <div className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/20 ring-1 ring-primary/30">
                  <Shield className="h-5 w-5 text-primary" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                    Protection plan
                  </p>
                  <h3 className="text-xl font-bold text-white">{PR.headline}</h3>
                </div>
              </div>
              <p className="mt-4 flex items-baseline gap-1.5">
                <span className="text-4xl font-black tabular-nums text-white">{PR.priceMain}</span>
              </p>
              <div className="mt-3 rounded-xl border border-orange-400/30 bg-orange-500/10 px-3 py-2">
                <p className="text-xs font-semibold text-orange-200">
                  🔥 Limited Time Offer: Only 482/500 Lifetime Licenses Left
                </p>
                <p className="mt-1 text-xs text-orange-100/80">Offer ends in {countdown}</p>
              </div>
              <p className="mt-1 text-sm text-slate-500">{PR.noSubscriptionsLine}</p>
              <ul className="mt-6 space-y-3">
                {PR.valueStack.map((f) => (
                  <li key={f.line} className="flex gap-2.5 text-sm text-slate-200">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                    {f.line}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col items-stretch gap-3">
                <Button type="button" onClick={onCta} className="w-full py-3.5 text-base font-semibold">
                  Activate Lifetime Protection
                </Button>
                <p className="text-center text-xs text-slate-400">
                  Stop being a cash cow for $300/year subscriptions. Pay once. Own your privacy forever.
                </p>
                <div className="pt-1">
                  <SecureCheckoutBar />
                </div>
              </div>
            </div>
          </Card>
        </SectionReveal>
      </div>
    </section>
  );
}
