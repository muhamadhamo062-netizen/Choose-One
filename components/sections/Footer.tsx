import type { ReactNode } from "react";
import Link from "next/link";
import { PrivacyEraserLogo } from "@/components/brand/PrivacyEraserLogo";
import { CORE_PRODUCT_COPY as COPY } from "@/lib/product-messaging";
import { cn } from "@/lib/utils";

const FT = COPY.footer;

const linkClass =
  "text-sm text-slate-400 transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111827]";

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className={linkClass}>
        {children}
      </Link>
    </li>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-[#111827]">
      <div className="section-container py-12 lg:py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6 xl:gap-10">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex transition-opacity hover:opacity-90">
              <PrivacyEraserLogo variant="full" markSize={36} />
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">{FT.blurb}</p>
          </div>

          <FooterCol title={FT.columns.product}>
            <li>
              <a href="/#scanner" className={linkClass}>
                {FT.links.freeScan}
              </a>
            </li>
            <FooterLink href="/remove-personal-data">{FT.links.removePersonalData}</FooterLink>
            <FooterLink href="/data-broker-removal">{FT.links.dataBrokerRemoval}</FooterLink>
            <FooterLink href="/opt-out-data-brokers">{FT.links.optOutBrokers}</FooterLink>
            <FooterLink href="/remove/spokeo">{FT.links.manualGuides}</FooterLink>
          </FooterCol>

          <FooterCol title={FT.columns.company}>
            <FooterLink href="/about">{FT.links.about}</FooterLink>
            <FooterLink href="/contact">{FT.links.contact}</FooterLink>
          </FooterCol>

          <FooterCol title={FT.columns.legal}>
            <FooterLink href="/privacy">{FT.links.privacy}</FooterLink>
            <FooterLink href="/terms">{FT.links.terms}</FooterLink>
          </FooterCol>

          <FooterCol title={FT.columns.support}>
            <FooterLink href="/support">{FT.links.support}</FooterLink>
            <FooterLink href="/faq">{FT.links.faq}</FooterLink>
            <FooterLink href="/help">{FT.links.help}</FooterLink>
            <FooterLink href="/status">{FT.links.status}</FooterLink>
          </FooterCol>
        </div>

        <div
          className={cn(
            "mt-12 border-t border-slate-800/90 pt-8",
            "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
          )}
        >
          <div className="space-y-1">
            <p className="text-xs text-slate-500">{FT.copyright}</p>
            <p className="max-w-lg text-[0.68rem] leading-relaxed text-slate-600">{FT.privacyNote}</p>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-slate-600">{FT.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
