import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "System Status | PrivacyEraser.ai",
  description: "Operational status for PrivacyEraser.ai services, scanning, and checkout."
};

export default function StatusPage() {
  return (
    <>
      <main className="min-h-0 w-full flex-1 pb-24 pt-10">
        <div className="section-container max-w-3xl">
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">Status</h1>
          <p className="mt-2 text-slate-400">This page is a public placeholder. Subscribe to your incident comms in production.</p>

          <Card className="mt-8 p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15">
                <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">All systems operational</p>
                <p className="mt-1 text-sm text-slate-400">Scanning, dashboard access, and payment checkout are up.</p>
                <p className="mt-2 text-xs text-slate-500">Last checked: this page is static until you add status monitoring.</p>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
