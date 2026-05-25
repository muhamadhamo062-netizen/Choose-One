import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";
import { SectionReveal } from "@/components/ui/SectionReveal";

const SP = COPY.socialProof;

export function SocialProofSection() {
  return (
    <section className="py-10 sm:py-12">
      <div className="section-container">
        <SectionReveal>
          <ul className="mx-auto max-w-2xl space-y-2 text-center text-sm text-slate-400 sm:text-base">
            {SP.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-slate-800/80 bg-slate-950/50 p-5 sm:p-6">
            <p className="text-center text-xs font-medium uppercase tracking-wider text-slate-500">
              {SP.exampleNote}
            </p>
            <ul className="mt-4 space-y-4">
              {SP.exampleQuotes.map((q) => (
                <li key={q.text}>
                  <blockquote className="border-l-2 border-primary/50 pl-4 text-left text-sm italic text-slate-300">
                    &ldquo;{q.text}&rdquo;
                  </blockquote>
                  <p className="mt-1.5 pl-4 text-right text-xs text-slate-500">— {q.by}</p>
                </li>
              ))}
            </ul>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
