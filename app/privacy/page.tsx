import type { Metadata } from "next";
import { LegalProseLayout } from "@/components/legal/LegalProseLayout";

export const metadata: Metadata = {
  title: "Privacy Policy | PrivacyEraser.ai",
  description: "How PrivacyEraser.ai handles your information — plain language, privacy-first."
};

export default function PrivacyPage() {
  return (
    <LegalProseLayout title="Privacy Policy">
      <p className="text-base text-slate-200">
        We built PrivacyEraser to <strong className="font-semibold text-white">protect</strong> your identity — not to
        collect or resell your data. This page explains what we keep, why we keep it, and your choices.
      </p>

      <section>
        <h2>What we collect</h2>
        <p>
          Information you choose to give us: name, email, state, and anything you enter for a scan or account. For
          checkout, payment details are handled by our payment partner — we do not store full card numbers on our servers.
        </p>
        <p>
          Basic technical logs (browser type, errors, security events) help us keep the service reliable and your account
          safe.
        </p>
      </section>

      <section>
        <h2>How we use it</h2>
        <p>
          To run your scan, operate your account, process Lifetime Protection, send service emails (receipts, alerts,
          support replies), and improve the product. If you activate removal and monitoring, we use your details only to
          submit and track opt-out requests on people-search and listing sites you are covered for.
        </p>
        <p>
          <strong className="font-semibold text-white">We do not sell your personal information.</strong> We do not buy
          marketing lists or broker your data to advertisers.
        </p>
      </section>

      <section>
        <h2>How we protect it</h2>
        <p>
          We use encryption in transit, access controls, and least-privilege practices on our systems. No online service
          can promise perfect security — please use a strong password and keep your devices updated.
        </p>
      </section>

      <section>
        <h2>Service providers</h2>
        <p>
          We work with trusted vendors for hosting, email, analytics, and payments. They may process data only to provide
          those services for us, under confidentiality and security obligations.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>
          You can request access, correction, or deletion of account data by contacting us through the Contact page.
          Depending on where you live, you may have additional privacy rights under local law; we will honor valid requests
          as required.
        </p>
      </section>

      <section>
        <h2>Questions</h2>
        <p>
          Email us via the Contact page. We respond to privacy requests as quickly as we can, typically within one to two
          business days.
        </p>
      </section>
    </LegalProseLayout>
  );
}
