import { ScannerPanel } from "@/components/scanner/ScannerPanel";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { InstantCredibilityStrip } from "@/components/trust/InstantCredibilityStrip";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";

const SC = COPY.scan;

export function ScannerSection() {
  return (
    <section id="scanner" className="py-14">
      <div className="section-container">
        <InstantCredibilityStrip variant="compact" />
        <SectionReveal>
          <div className="mb-6 max-w-2xl">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">{SC.sectionTitle}</h2>
            <p className="mt-3 text-slate-300">{SC.sectionDescription}</p>
          </div>
          <ScannerPanel />
        </SectionReveal>
      </div>
    </section>
  );
}
