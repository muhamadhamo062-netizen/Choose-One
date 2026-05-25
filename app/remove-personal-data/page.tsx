import type { Metadata } from "next";
import { SeoLandingTemplate } from "@/components/seo/SeoLandingTemplate";
import { buildSeoMetadata, getSeoPage } from "@/lib/seo-landing-content";

const key = "remove-personal-data" as const;

export const metadata: Metadata = buildSeoMetadata(key);

export default function RemovePersonalDataPage() {
  return <SeoLandingTemplate def={getSeoPage(key)} />;
}
