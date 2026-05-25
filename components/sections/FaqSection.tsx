import { Card } from "@/components/ui/Card";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";

const FAQ = COPY.faq;

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 py-14">
      <div className="section-container">
        <SectionReveal>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">{FAQ.title}</h2>
          <div className="mt-6 grid gap-4">
            {FAQ.items.map((faq) => (
              <Card key={faq.question}>
                <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{faq.answer}</p>
              </Card>
            ))}
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
