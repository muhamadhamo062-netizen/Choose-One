import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SectionReveal } from "@/components/ui/SectionReveal";

export function FinalCtaSection() {
  return (
    <section className="pb-24 pt-10">
      <div className="section-container">
        <SectionReveal>
          <Card className="border border-danger/40 bg-gradient-to-r from-danger/10 to-primary/10 text-center">
            <h2 className="text-balance text-3xl font-bold text-white sm:text-4xl">
              Every day your data stays online is a risk.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-300">
              Reduce your exposure now before your contact info, address history, and relatives are weaponized.
            </p>
            <div className="mt-7">
              <Link
                href="#pricing"
                className="inline-flex min-h-11 min-w-[12rem] items-center justify-center rounded-xl bg-danger px-8 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] hover:bg-red-500"
              >
                See protection plans
              </Link>
            </div>
          </Card>
        </SectionReveal>
      </div>
    </section>
  );
}