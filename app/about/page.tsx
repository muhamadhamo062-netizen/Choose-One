import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "About | PrivacyEraser.ai",
  description: "Mission, team values, and how PrivacyEraser.ai helps you remove exposed data from brokers."
};

export default function AboutPage() {
  return (
    <>
      <main className="min-h-0 w-full flex-1 pb-24 pt-10">
        <div className="section-container max-w-3xl">
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">About PrivacyEraser.ai</h1>
          <p className="mt-2 text-slate-400">Security-first privacy automation for the age of data brokers.</p>

          <Card className="mt-8 space-y-4 p-6 text-slate-300">
            <p className="leading-7">
              PrivacyEraser.ai exists to help consumers take back control when their personal information is indexed and sold
              across people-search and data broker networks. We combine automated opt-out workflows with clear reporting so you
              know what was requested, when, and what to do if a listing returns.
            </p>
            <p className="leading-7">
              We are not a law firm. We do not provide legal advice. Our tools are designed to support lawful opt-out and
              deletion requests with a premium, security-minded user experience.
            </p>
          </Card>
        </div>
      </main>
    </>
  );
}
