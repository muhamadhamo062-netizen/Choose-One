"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Gift } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ensureUserReferralInStorage } from "@/lib/referral-code";
import { getPeUser } from "@/lib/scan-storage";
import { buildViralScanShareUrl } from "@/lib/viral-share-link";
import { cn } from "@/lib/utils";

export function ReferralClient() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [copy, setCopy] = useState<"idle" | "ok">("idle");
  const [ready, setReady] = useState(false);
  const [hasUser, setHasUser] = useState(false);

  useEffect(() => {
    const u = getPeUser();
    setHasUser(!!u);
    if (u) {
      setCode(ensureUserReferralInStorage());
    }
    setReady(true);
  }, []);

  const shareUrl = typeof window !== "undefined" ? buildViralScanShareUrl() : "";

  const onCopy = () => {
    if (!code) {
      return;
    }
    const link =
      shareUrl || (typeof window !== "undefined" ? `${window.location.origin}/?ref=${encodeURIComponent(code)}#scanner` : "");
    const line = `Join me on PrivacyEraser — use my code ${code} or this link: ${link}`;
    void navigator.clipboard.writeText(line).then(() => {
      setCopy("ok");
      window.setTimeout(() => setCopy("idle"), 2000);
    });
  };

  if (!ready) {
    return <div className="mx-auto h-40 max-w-2xl animate-pulse rounded-2xl bg-slate-800/50" aria-hidden />;
  }

  if (!hasUser) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-md">
        <Card className="border border-slate-800 p-6 text-center sm:p-8">
          <Gift className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 text-xl font-bold text-white">Create an account to get your code</h2>
          <p className="mt-2 text-sm text-slate-400">
            Referral rewards apply after you have a dashboard. Sign up free, then return here to copy your link.
          </p>
          <Button className="mt-6 w-full" type="button" onClick={() => router.push("/signup?from=referral")}>
            Sign up free
          </Button>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-white sm:text-4xl">Refer friends &amp; get rewarded</h1>
        <p className="mt-2 text-slate-400">
            Share your code. When friends run a free U.S. exposure scan, you unlock referral credit toward dark-web monitoring
            and broker coverage.
        </p>
      </div>

      <Card className="border border-primary/30 bg-slate-900/40 p-6 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Your code</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white sm:text-3xl">
              {code ?? "—"}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full min-w-40 sm:w-auto"
            onClick={onCopy}
            disabled={!code}
          >
            {copy === "ok" ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy code + link
              </>
            )}
          </Button>
        </div>
        <p className={cn("mt-4 text-sm", "text-slate-500")}>
            <span className="font-semibold text-emerald-200/90">Reward (placeholder):</span> 1 month of extra monitoring
            credit per qualified referral (terms apply; not legal tender).
        </p>
      </Card>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5 text-sm text-slate-400">
        <h2 className="text-base font-semibold text-slate-200">How it works</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>Share your code or the copied link (includes <code className="text-slate-300">?ref=</code> for attribution).</li>
          <li>Your friend runs the free scan at PrivacyEraser.ai.</li>
          <li>We attribute the visit and credit your account when they convert or hit milestones (implementation pending).</li>
        </ol>
        <p className="mt-4 text-xs text-slate-500">
            Need a scan yourself? <Link className="font-medium text-primary hover:underline" href="/#scanner">Run the free check</Link>
        </p>
      </div>
    </div>
  );
}
