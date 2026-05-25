import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Help Center | PrivacyEraser.ai",
  description: "Quick answers about data removal, scanning, account access, and troubleshooting."
};

export default function HelpPage() {
  return (
    <>
      <main className="min-h-0 w-full flex-1 pb-24 pt-10">
        <div className="section-container max-w-3xl">
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">Help Center</h1>
          <p className="mt-2 text-slate-400">Guides and quick answers. Full library coming soon—contact support for urgent help.</p>

          <ul className="mt-8 space-y-3">
            <li>
              <Link href="/#scanner" className="block">
                <Card className="p-4 transition-colors hover:border-primary/40">
                  <p className="font-semibold text-white">Run a new exposure scan</p>
                  <p className="text-sm text-slate-400">Open the identity scanner and review exposure signals.</p>
                </Card>
              </Link>
            </li>
            <li>
              <Link href="/remove/spokeo" className="block">
                <Card className="p-4 transition-colors hover:border-primary/40">
                  <p className="font-semibold text-white">Manual removal guides (example: Spokeo)</p>
                  <p className="text-sm text-slate-400">See the real-world complexity of a broker opt-out path.</p>
                </Card>
              </Link>
            </li>
            <li>
              <Link href="/contact" className="block">
                <Card className="p-4 transition-colors hover:border-primary/40">
                  <p className="font-semibold text-white">Contact support</p>
                  <p className="text-sm text-slate-400">Message our team for account access, billing, or case updates.</p>
                </Card>
              </Link>
            </li>
            <li>
              <Link href="/status" className="block">
                <Card className="p-4 transition-colors hover:border-primary/40">
                  <p className="font-semibold text-white">System status</p>
                  <p className="text-sm text-slate-400">Check the Help Center’s sister page for uptime and incidents.</p>
                </Card>
              </Link>
            </li>
          </ul>
        </div>
      </main>
    </>
  );
}
