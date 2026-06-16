import type { Metadata } from "next";
import { LegalProseLayout } from "@/components/legal/LegalProseLayout";

export const metadata: Metadata = {
  title: "Terms of Service | PrivacyEraser.ai",
  description: "Simple terms for using PrivacyEraser.ai scans, dashboard, and Lifetime Protection."
};

export default function TermsPage() {
  return (
    <LegalProseLayout title="Terms of Service">
      <p className="text-base text-slate-200">
        By using PrivacyEraser.ai, you agree to these terms. If you do not agree, please do not use the service.
      </p>

      <section>
        <h2>Using the service</h2>
        <p>
          PrivacyEraser provides exposure scans, monitoring, and removal support for U.S. residents. Use it lawfully, keep
          your login secure, and provide accurate information for your own identity.
        </p>
        <p>
          Scan results show where your information may appear on people-search sites, public records-style sources, and
          breach indexes. Results are informational — they are not legal advice and may not be complete or up to the
          minute.
        </p>
      </section>

      <section>
        <h2>Lifetime Protection &amp; payments</h2>
        <p>
          Paid features are described at checkout. Lifetime Protection is a one-time purchase (not a subscription unless
          clearly stated otherwise). Payments are processed by our payment partner; refund rules shown at purchase and
          applicable law apply.
        </p>
      </section>

      <section>
        <h2>What we do not guarantee</h2>
        <p>
          People-search sites change often. We cannot guarantee every listing will be removed instantly or stay removed
          forever. We work through supported opt-out channels and re-check when data reappears for active accounts.
        </p>
        <p>PrivacyEraser is not a law firm and does not provide legal advice.</p>
      </section>

      <section>
        <h2>Account &amp; availability</h2>
        <p>
          We may update the product, pause access for abuse or security reasons, or discontinue features with reasonable
          notice where practicable. You may stop using the service at any time.
        </p>
      </section>

      <section>
        <h2>Liability</h2>
        <p>
          The service is provided &quot;as is&quot; to the extent permitted by law. Our total liability for claims related
          to the service is limited to the amount you paid us in the three months before the claim, or one hundred U.S.
          dollars, whichever is greater, except where law does not allow that limit.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions about these terms? Reach us through the Contact page.</p>
      </section>
    </LegalProseLayout>
  );
}
