import type { Metadata } from "next";
import { LegalProseLayout } from "@/components/legal/LegalProseLayout";

export const metadata: Metadata = {
  title: "Terms of Service | PrivacyEraser.ai",
  description: "Terms governing use of the PrivacyEraser.ai website, software, and services."
};

export default function TermsPage() {
  return (
    <LegalProseLayout title="Terms of Service">
      <section>
        <h2>Acceptance of Terms</h2>
        <p>
          By accessing or using PrivacyEraser.ai’s website, services, and related features, you agree to these Terms. If you
          do not agree, do not use the service. We may update these Terms from time to time; the “Last updated” date will
          change, and continued use after changes constitutes acceptance, except where a jurisdiction requires a different
          notice mechanism.
        </p>
      </section>

      <section>
        <h2>Use of Service</h2>
        <p>
          You agree to use the service only in compliance with applicable law and in a way that does not harm other users, our
          infrastructure, or third parties. You may not attempt to access accounts you do not own, probe for vulnerabilities
          without authorization, reverse engineer our product except to the extent permitted by law, or use automated means to
          scrape, harvest, or bypass rate limits where prohibited.
        </p>
        <p>
          The service is provided for your personal, non-commercial use unless you have a written agreement permitting
          business use. You are responsible for the accuracy of information you provide (including identifiers you submit to
          generate results) and for keeping your account credentials secure.
        </p>
        <p>
          Data broker and public-records sources change frequently. We do not guarantee that any scan result is complete,
          current, or error-free, and you should not rely on results as a sole source of legal truth.
        </p>
      </section>

      <section>
        <h2>Payment Terms</h2>
        <p>
          Paid features and one-time purchases (including Lifetime Protection) are subject to the pricing and checkout details presented at
          purchase, including any taxes and refund limitations displayed at the point of sale. Payments are processed by our
          payment partners; by purchasing, you agree to their applicable terms to the extent they govern payment data and
          receipts.
        </p>
        <p>
          Refund eligibility is governed by the terms displayed at checkout, this Agreement, and applicable law. Unless
          otherwise required by law or expressly stated at purchase, digital access may be non-refundable after delivery
          except where your payment processor or jurisdiction requires otherwise.
        </p>
        <p>
          If a charge is disputed, we may pause service until the dispute is resolved, subject to the processor&apos;s rules
          and evidence requirements.
        </p>
      </section>

      <section>
        <h2>Limitations of Liability</h2>
        <p>
          To the maximum extent permitted by law, the service is provided on an “as is” and “as available” basis, without
          warranties of any kind, whether express, implied, or statutory, including implied warranties of merchantability,
          fitness for a particular purpose, and non-infringement. We do not warrant that the service will be uninterrupted,
          error-free, or that defects will be corrected.
        </p>
        <p>
          To the maximum extent permitted by law, in no event will our aggregate liability arising out of or related to the
          service or these terms exceed the greater of (a) the fees you paid to us in the three (3) months before the event
          giving rise to liability, or (b) one hundred U.S. dollars (USD $100), except where a jurisdiction disallows
          limitations for gross negligence, willful misconduct, or other non-waivable rights.
        </p>
        <p>
          You understand that public exposure, fraud risk, and identity issues can stem from many sources beyond the service. We
          are not an insurer and do not guarantee that using the product will stop harm from occurring.
        </p>
      </section>

      <section>
        <h2>Termination</h2>
        <p>
          You may stop using the service at any time. We may suspend or terminate access if you violate these Terms, if we
          must comply with law, or if we reasonably believe continued access creates risk, fraud, or abuse. Upon termination,
          the provisions that by their nature should survive (including limitations, disclaimers, and dispute terms) will
          survive, as applicable.
        </p>
        <p>
          If you have questions about your account, export needs, or legal notices, use the site’s contact channel. This
          placeholder is not legal advice—have it reviewed by licensed counsel.
        </p>
      </section>
    </LegalProseLayout>
  );
}
