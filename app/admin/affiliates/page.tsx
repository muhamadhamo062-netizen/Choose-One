import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Admin Affiliates | PrivacyEraser.ai"
};
export const dynamic = "force-dynamic";

export default function AdminAffiliatesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-xl font-bold text-white">Admin Affiliates Disabled</h1>
        <p className="mt-3 text-sm text-slate-300">
          Internal affiliate admin tools are disabled. Use Lemon Squeezy Affiliates for onboarding, tracking, and payouts.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
