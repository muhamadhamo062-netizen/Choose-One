import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";
import { SEO_HUB_LINKS, type SeoPageDef } from "@/lib/seo-landing-content";

const CTA_LABEL = COPY.scan.form.runButton;

function jsonLdWebPage(def: SeoPageDef, canonicalPath: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://privacyeraser.ai";
  const url = `${base.replace(/\/$/, "")}${canonicalPath}`;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: def.h1,
    description: def.description,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: "PrivacyEraser.ai",
      url: base.replace(/\/$/, "")
    }
  };
}

export function SeoLandingTemplate({ def }: { def: SeoPageDef }) {
  const path = `/${def.key}`;
  const schema = jsonLdWebPage(def, path);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <div className="flex w-full flex-1 flex-col pb-20">
        <nav
          className="border-b border-slate-800/60 bg-slate-950/30"
          aria-label="Breadcrumb"
        >
          <div className="section-container py-3">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-400">
              <li>
                <Link href="/" className="text-primary transition hover:underline">
                  Home
                </Link>
              </li>
              <li className="flex items-center gap-1" aria-hidden>
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </li>
              <li className="text-slate-200">{def.breadcrumbLabel}</li>
            </ol>
          </div>
        </nav>

        <article className="section-container py-12 lg:py-16">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-balance text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
              {def.h1}
            </h1>

            <div className="mt-8 space-y-4 text-base leading-relaxed text-slate-300">
              {def.intro.map((p, i) => (
                <p key={`intro-${i}`}>{p}</p>
              ))}
            </div>

            <section className="mt-12 border-t border-slate-800/80 pt-10">
              <h2 className="text-xl font-bold text-white sm:text-2xl">{def.problem.h2}</h2>
              <div className="mt-4 space-y-4 text-slate-300">
                {def.problem.body.map((p, i) => (
                  <p key={`problem-${i}`} className="leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </section>

            <section className="mt-12 border-t border-slate-800/80 pt-10">
              <h2 className="text-xl font-bold text-white sm:text-2xl">{def.solution.h2}</h2>
              <div className="mt-4 space-y-4 text-slate-300">
                {def.solution.body.map((p, i) => (
                  <p key={`sol-${i}`} className="leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </section>

            <div className="mt-12 rounded-2xl border border-primary/30 bg-slate-900/50 p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-white sm:text-xl">{CTA_LABEL}</h2>
              <p className="mt-2 text-sm text-slate-400">
                Problem → risk → scan on our homepage. No account required to run the first check.
                Checkout only appears if you choose Lifetime Protection.
              </p>
              <div className="mt-6">
                <Link
                  href="/#scanner"
                  className="inline-flex w-full min-w-[14rem] items-center justify-center rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.02] hover:bg-indigo-500 sm:w-auto"
                >
                  {CTA_LABEL}
                </Link>
              </div>
            </div>

            <section className="mt-12 rounded-xl border border-slate-800/80 bg-slate-900/30 p-5 sm:p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Related & useful links
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Related guides. Start a free scan on the home page — pricing appears only at checkout
                for Lifetime Protection.
              </p>
              <ul className="mt-4 flex flex-col gap-2 sm:grid sm:grid-cols-2">
                {SEO_HUB_LINKS.map((item) => {
                  const selfPage = `/${def.key}`;
                  const active = item.href === selfPage;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={
                          active
                            ? "text-sm font-medium text-primary"
                            : "text-sm text-slate-300 underline-offset-2 hover:text-white hover:underline"
                        }
                        {...(active ? { "aria-current": "page" as const } : {})}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </article>
      </div>
    </>
  );
}
