import { Gavel, Radio, Scale, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";

const TR = COPY.trust;
/** One icon per trust badge — must match `COPY.trust.badges.length`. */
const TRUST_ICONS = [Scale, ShieldCheck, Gavel, Radio] as const;

export function TrustBadgesSection() {
  return (
    <section className="py-14">
      <div className="section-container">
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          {TR.kicker}
        </p>
        <h2 className="mx-auto max-w-2xl text-balance text-center text-xl font-bold text-white sm:text-2xl">
          {TR.headline}
        </h2>
        <SectionReveal className="mt-8 grid gap-4 md:grid-cols-3">
          {TR.badges.map((title, i) => {
            const Icon = TRUST_ICONS[i];
            return (
              <Card key={title} className="flex items-start gap-3 p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <p className="text-sm font-semibold leading-snug text-slate-100">{title}</p>
              </Card>
            );
          })}
        </SectionReveal>
      </div>
    </section>
  );
}
