import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LegalProseLayout } from "@/components/legal/LegalProseLayout";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";

export const metadata: Metadata = {
  title: "Refund Policy | PrivacyEraser.ai",
  description:
    "Refund policy for PrivacyEraser.ai, including AppSumo Lifetime Deal purchases and the 60-day money-back guarantee."
};

export default function RefundPolicyPage() {
  const badgeLine = COPY.refundGuarantee.badgeLine;
  return (
    <LegalProseLayout title="Refund Policy">
      <section>
        <div className="mb-8 flex flex-col gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-4 sm:flex-row sm:items-center">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-400/30">
            <ShieldCheck className="h-7 w-7 text-emerald-400" aria-hidden />
          </span>
          <div>
            <p className="text-base font-bold text-emerald-100">{badgeLine}</p>
            <p className="mt-1 text-sm text-slate-400">
              This policy is designed to align with marketplace standards for U.S. customers, including purchases made through{" "}
              <strong className="font-semibold text-slate-300">AppSumo</strong>.
            </p>
          </div>
        </div>
        <h2>AppSumo purchases</h2>
        <p>
          If you purchased PrivacyEraser.ai through <strong>AppSumo</strong>, your purchase is eligible for a{" "}
          <strong>full refund within sixty (60) days</strong> from the date of purchase, <strong>no questions asked</strong>.
          You do not need to provide a reason to request a refund during this period. After AppSumo processes an approved
          refund in accordance with its policies, access to paid features associated with that purchase will end.
        </p>
        <p>
          To request a refund for an AppSumo purchase, follow AppSumo&apos;s refund workflow in your AppSumo account or
          contact AppSumo support directly. If you need help locating your order or linking it to your PrivacyEraser.ai
          account, you may also contact us via{" "}
          <Link href="/support" className="text-primary underline-offset-2 hover:underline">
            Support
          </Link>
          .
        </p>
      </section>

      <section>
        <h2>Direct purchases (website checkout)</h2>
        <p>
          If you purchased Lifetime Protection directly through our website (for example, via our payment processor at
          checkout), refund eligibility depends on the terms shown at the point of sale and applicable law. Where we offer a
          comparable guarantee for direct checkout, it will be stated on the checkout screen or in writing at purchase.
        </p>
        <p>
          For questions about a direct purchase, contact us through{" "}
          <Link href="/support" className="text-primary underline-offset-2 hover:underline">
            Support
          </Link>{" "}
          with the email address used at checkout and any receipt or transaction identifier you received.
        </p>
      </section>

      <section>
        <h2>Chargebacks and disputes</h2>
        <p>
          If you dispute a charge with your bank or card issuer, we may pause or revoke access until the dispute is
          resolved, and we will cooperate with reasonable verification requests from payment partners.
        </p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>
          We may update this Refund Policy from time to time. The &quot;Last updated&quot; date on this page will change when
          revisions are published. AppSumo-specific commitments described above apply to qualifying AppSumo purchases made
          while those terms are in effect.
        </p>
      </section>

      <section>
        <h2>Related terms</h2>
        <p>
          This policy works together with our{" "}
          <Link href="/terms" className="text-primary underline-offset-2 hover:underline">
            Terms of Service
          </Link>
          . If anything conflicts, the more specific refund language on this page applies to refund eligibility for AppSumo
          purchases as described here.
        </p>
      </section>
    </LegalProseLayout>
  );
}
