import type { Metadata } from "next";
import { SeoLandingTemplate } from "@/components/seo/SeoLandingTemplate";
import { buildSeoMetadata, getSeoPage } from "@/lib/seo-landing-content";

const key = "data-broker-removal" as const;

export const metadata: Metadata = buildSeoMetadata(key);

export default function DataBrokerRemovalPage() {
  return <SeoLandingTemplate def={getSeoPage(key)} />;
}
