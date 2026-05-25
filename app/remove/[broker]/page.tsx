import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, Mail, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { brokerTitleFromSlug } from "@/lib/broker-slug";

interface PageProps {
  params: { broker: string };
}

export function generateMetadata({ params }: PageProps): Metadata {
  const name = brokerTitleFromSlug(params.broker);
  return {
    title: `How to remove your data from ${name} (Step-by-Step) | PrivacyEraser.ai`,
    description: `${name} opt out guide — remove data from ${name}, delete personal info, and understand wait times, verification, and relisting risks.`
  };
}

export default function RemoveBrokerPage({ params }: PageProps) {
  const broker = brokerTitleFromSlug(params.broker);
  const brokerLower = broker.toLowerCase();

  return (
    <div className="flex w-full flex-1 flex-col pb-20">
      <div className="section-container border-b border-slate-800/50 py-4">
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          ← Back to PrivacyEraser.ai
        </Link>
      </div>
      <section className="border-b border-slate-800/80 py-16">
        <div className="section-container">
          <div className="mx-auto max-w-3xl text-center">
            <Badge>Manual opt-out & removal</Badge>
            <h1 className="mt-4 text-balance text-4xl font-extrabold text-white sm:text-5xl">
              How to remove your data from {broker} (Step-by-Step)
            </h1>
            <h2 className="mt-3 text-balance text-xl font-bold text-slate-200 sm:text-2xl">
              How to remove data from {broker}
            </h2>
            <p className="mt-4 text-lg text-slate-300">
              Follow this manual process to remove your personal data from {broker}. This guide is detailed on purpose:{" "}
              <span className="text-slate-200">data broker takedowns are slow, fragile, and easy to get wrong</span>.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/#scanner"
                className="inline-flex w-full min-w-[12rem] items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.02] hover:bg-indigo-500 sm:w-auto"
              >
                <Search className="h-4 w-4" />
                Free scan — see every listing
              </Link>
              <Link
                href="/#pricing"
                className="inline-flex w-full min-w-[12rem] items-center justify-center rounded-xl border border-slate-600 bg-slate-900/50 px-6 py-3 text-sm font-semibold text-slate-200 hover:border-primary hover:text-white sm:w-auto"
              >
                See pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="section-container max-w-3xl space-y-12 py-14">
        <SectionReveal>
          <h2 className="text-2xl font-bold text-white">1. What you are trying to delete from {broker}</h2>
          <p className="mt-3 text-slate-300">
            A typical {broker} profile can include your name, age range, current and past addresses, phone numbers, relatives, and
            associated people. A successful removal is not a single click — you are trying to get each sensitive fact{" "}
            <span className="text-slate-200">removed or suppressed from public-facing pages on {brokerLower}</span>, and that takes time.
          </p>
          <p className="mt-3 text-slate-300">
            If you want to rank in search for <span className="text-slate-200">remove data from {brokerLower}</span>, save this page.
            If you are tired of the manual workflow, the psychological pitch is true: the fastest path to fewer listings is
            someone doing the re-submission loop for you.
          </p>
        </SectionReveal>

        <SectionReveal>
          <h2 className="text-2xl font-bold text-white">2. Find the exact {broker} listing URL</h2>
          <p className="mt-3 text-slate-300">
            You need the URL of your profile, not a search results page. Search {broker} with your name and city, then open
            the profile. Copy the long URL, save it, and re-open in an incognito window to confirm the page is still public. If
            you have multiple {broker} results, you may need to opt out of each.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-300">
            <li>Try multiple cities you have lived in, not only your current address.</li>
            <li>Try maiden names, common nicknames, and middle initial variants.</li>
            <li>If a profile is missing, it does not mean you are clean — {broker} may re-add it later from another source.</li>
          </ul>
        </SectionReveal>

        <SectionReveal>
          <div className="relative overflow-hidden rounded-2xl border-2 border-primary/50 bg-primary/5 p-6 shadow-glow sm:p-8">
            <div className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
            <h3 className="text-xl font-bold text-white sm:text-2xl">Skip the hassle. Let PrivacyEraser.ai remove your data automatically.</h3>
            <p className="mt-2 text-slate-300">
              The manual {broker} opt out path below is the real timeline most people do not have patience for. If you want a
              conversion-first outcome — fewer public listings, fewer re-submissions — use automation instead of a weekend project.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/#scanner"
                className="inline-flex w-full min-w-[12rem] items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.02] hover:bg-indigo-500 sm:w-auto"
              >
                <Search className="h-4 w-4" />
                Free scan
              </Link>
              <Link
                href="/#pricing"
                className="inline-flex w-full min-w-[12rem] items-center justify-center gap-2 rounded-xl border border-slate-500/80 bg-slate-900/50 px-8 py-3 text-sm font-semibold text-white transition-colors hover:border-primary hover:text-white sm:w-auto"
              >
                See lifetime pricing
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </SectionReveal>

        <SectionReveal>
          <h2 className="text-2xl font-bold text-white">3. Locate the {broker} opt out form (and read the small print)</h2>
          <p className="mt-3 text-slate-300">
            Most {broker} removals start with a web form, but the fields change over time. You will usually be asked for name,
            city, state, and a reason for the request. Some flows ask for a profile URL, others ask for an email to verify. If
            the site asks for extra identifiers, slow down: only share what the form actually requires, and only on the official
            {broker} domain.
          </p>
          <p className="mt-3 text-slate-300">
            If you are searching for a <span className="text-slate-200">{broker} opt out guide</span>, the hidden footnote is
            the same: you will probably repeat this step more than once if a listing reappears or if your record splits into
            duplicates.
          </p>
        </SectionReveal>

        <SectionReveal>
          <h2 className="text-2xl font-bold text-white">4. Email verification, proof requests, and ID checks</h2>
          <p className="mt-3 text-slate-300">
            Many brokers (including {broker} and similar) send a verification link. The email may be delayed, land in spam, or
            expire. If the email never arrives, you restart. If you are asked to upload a government ID, consider redacting
            unrelated fields and only sending the minimum, but you may still be rejected if the document does not match their
            internal rules. That is another multi-day back-and-forth.
          </p>
        </SectionReveal>

        <SectionReveal>
          <h2 className="text-2xl font-bold text-white">5. Wait periods, re-checks, and “ghost profiles” on {broker}</h2>
          <p className="mt-3 text-slate-300">
            <span className="text-slate-200">It may take 2–6 weeks</span> to see a profile disappear, and in many cases a
            listing looks gone while a cached or alternate URL still exists. The painful part is the re-checking: you re-run the
            same name searches weekly, and when something pops back, you re-submit. That is the manual removal grind in one
            sentence.
          </p>
          <Card className="mt-4 border border-amber-500/40 bg-amber-500/5">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
              <div>
                <p className="font-semibold text-amber-200">Warning: some listings reappear</p>
                <p className="mt-1 text-sm text-slate-300">
                  Brokers re-ingest from public and commercial data feeds. {broker} is not a static museum — the same name can
                  return under a new record ID, which can restart the entire workflow.
                </p>
              </div>
            </div>
          </Card>
        </SectionReveal>

        <SectionReveal>
          <h2 className="text-2xl font-bold text-white">6. The long, repetitive re-submission loop</h2>
          <p className="mt-3 text-slate-300">
            If a removal is denied, you re-open the help article, re-copy your proof, re-send the form, and wait again. If a
            removal is approved but a duplicate profile returns, you repeat the {broker} opt out steps. If you are reading this
            guide for the fifteenth time, you are not doing it wrong — the system is designed to be high-friction. That is why
            people look for a product like <span className="text-slate-200">PrivacyEraser.ai</span> in the first place.
          </p>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-slate-300">
            <li>Save a dated screenshot of the public profile.</li>
            <li>Save the case ID, ticket ID, or confirmation number if the site offers one.</li>
            <li>Re-test every URL variant you found — mobile vs desktop, old vs new domain paths.</li>
            <li>Re-submit if a record changes even slightly, because a small data delta can re-create a public page.</li>
            <li>Repeat the entire sequence when you move, change your phone, or a relative appears on your file.</li>
            <li>Repeat again when a third-party data vendor refreshes a batch.</li>
            <li>Repeat again when a search engine still shows a cached title snippet.</li>
            <li>Again: confirm incognito, confirm VPN-off, confirm different browsers, because you are debugging a moving target.</li>
          </ol>
        </SectionReveal>

        <SectionReveal>
          <h2 className="text-2xl font-bold text-white">7. A checklist you can use every time (because you will do this more than once)</h2>
          <ul className="mt-3 space-y-3 text-slate-300">
            <li className="flex gap-2">
              <Search className="h-4 w-4 shrink-0 text-primary" />
              Search your name in multiple city variants and keep the profile URLs in a document.
            </li>
            <li className="flex gap-2">
              <Mail className="h-4 w-4 shrink-0 text-primary" />
              Use an inbox you control for {broker} verification, and do not let the link expire.
            </li>
            <li className="flex gap-2">
              <Clock className="h-4 w-4 shrink-0 text-primary" />
              Put calendar reminders for 3 days, 14 days, 30 days, and 60 days to re-audit the listing.
            </li>
            <li className="flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-primary" />
              If you see a new phone number, assume the profile refreshed from another database — treat it as a new incident, not
              a fluke.
            </li>
          </ul>
        </SectionReveal>

        <SectionReveal>
          <h2 className="text-2xl font-bold text-white">8. The keyword reality for “delete personal info {brokerLower}”</h2>
          <p className="mt-3 text-slate-300">
            This page is intentionally long: people searching for <span className="text-slate-200">remove data from {brokerLower}</span>{" "}
            are usually in the middle of an exhausting loop. The honest outcome is that manual removal is possible, it is
            time-expensive, and the coverage problem is that <span className="text-slate-200">100+ other brokers may still publish the same data</span>. That is the real comparison table,
            and it is the conversion argument for a lifetime removal product.
          </p>
        </SectionReveal>
      </div>
    </div>
  );
}
