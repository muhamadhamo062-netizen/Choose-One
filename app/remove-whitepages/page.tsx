import type { Metadata } from "next";
import { SeoLandingTemplate } from "@/components/seo/SeoLandingTemplate";
import { buildSeoMetadata, getSeoPage } from "@/lib/seo-landing-content";

const key = "remove-whitepages" as const;

export const metadata: Metadata = buildSeoMetadata(key);

export default function RemoveWhitepagesSeoPage() {
  return <SeoLandingTemplate def={getSeoPage(key)} />;
}
