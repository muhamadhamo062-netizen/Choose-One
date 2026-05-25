import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { ContactResponseHighlight } from "@/components/contact/ContactResponseHighlight";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";

const C = COPY.contact;

export const metadata: Metadata = {
  title: "Contact Support | PrivacyEraser.ai",
  description: `${C.intro} ${C.responseTimeBody}`
};

export default function ContactPage() {
  return (
    <>
      <main className="min-h-0 w-full flex-1 pb-24 pt-10">
        <div className="section-container max-w-2xl">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-white sm:text-4xl">{C.pageTitle}</h1>
            <p className="mt-2 text-lg font-medium text-slate-200">{C.kicker}</p>
            <p className="mt-3 text-slate-400">{C.intro}</p>
          </div>

          <div className="mt-8">
            <ContactResponseHighlight />
          </div>

          <div className="mt-8">
            <ContactForm />
          </div>
        </div>
      </main>
    </>
  );
}
