import type { Metadata } from "next";
import { LegalProseLayout } from "@/components/legal/LegalProseLayout";

export const metadata: Metadata = {
  title: "Privacy Policy | PrivacyEraser.ai",
  description: "How PrivacyEraser.ai collects, uses, and protects information when you use our services."
};

export default function PrivacyPage() {
  return (
    <LegalProseLayout title="Privacy Policy">
      <section>
        <h2>Information We Collect</h2>
        <p>
          We collect information you provide directly, such as your name, email address, billing details, and messages you send
          through our support forms. We also collect limited technical information needed to operate the service, including
          device type, browser version, approximate region (when available), and usage logs (for example, error diagnostics and
          feature engagement), used to protect accounts and improve reliability.
        </p>
        <p>
          If you use our scanning features, you may provide identifiers to generate results. You should not submit
          high-sensitivity information unless a feature clearly requires it and you choose to provide it. We do not use your data
          to sell third-party marketing lists, and we do not purchase broker databases for resale.
        </p>
      </section>

      <section>
        <h2>How We Use Information</h2>
        <p>
          We use your information to provide the service, authenticate users, process payments, send transactional emails,
          respond to support requests, and maintain security (including abuse prevention and incident response). We may also use
          aggregated, de-identified data to understand product performance and to improve the user experience.
        </p>
        <p>
          Where you request broker-related actions, we use your information to prepare and track opt-out and deletion
          requests, and to help you understand outcomes (including follow-ups when a listing reappears, subject to the feature
          you purchased and broker policies).
        </p>
      </section>

      <section>
        <h2>Data Security</h2>
        <p>
          We implement technical and organizational safeguards designed to protect data in transit and at rest, including
          modern encryption in transit, access controls, and least-privilege practices for internal access. No method of
          transmission is 100% secure, and you should also protect your account credentials and devices.
        </p>
      </section>

      <section>
        <h2>Third-Party Services</h2>
        <p>
          We may use trusted vendors for hosting, analytics, email delivery, payment processing, and customer support tooling.
          These service providers are permitted to use your information only to perform services for us, consistent with
          appropriate confidentiality and security obligations, unless law requires otherwise.
        </p>
        <p>
          Payment processing (for example, a processor like Paddle) is handled by the processor’s own terms and privacy
          policy for payment data that they process on your behalf. We do not store full payment card details on our servers
          when your processor is responsible for cardholder data in accordance with its documentation.
        </p>
      </section>

      <section>
        <h2>User Rights</h2>
        <p>
          Depending on where you live, you may have rights to access, correct, delete, or port certain personal data, and to
          object to or restrict some processing. You may also have the right to appeal a decision where applicable. You can
          contact us to exercise your rights, and we will respond consistent with applicable law. If you are in the European
          Economic Area, the United Kingdom, or other regions with a designated representative requirement, the contact
          information below may be updated if we appoint one.
        </p>
        <p>
          If you are a California resident, you may have additional rights under the CCPA/CPRA, including the right to know,
          delete, and correct, and the right to opt out of “sharing”/targeted advertising where such concepts apply, subject to
          verification and legal exceptions. We do not “sell” personal information as a data broker, but we use limited
          analytics and may process data as described in this policy. For requests, use the contact method in this site’s
          Contact page.
        </p>
        <p>
          For any privacy request, please contact us at the email address you provide in app settings or the Contact form.
          This placeholder policy is not a substitute for counsel—have it reviewed before production.
        </p>
      </section>
    </LegalProseLayout>
  );
}
