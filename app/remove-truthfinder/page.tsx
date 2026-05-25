import type { Metadata } from "next";
import { SeoLandingTemplate } from "@/components/seo/SeoLandingTemplate";
import { buildSeoMetadata, getSeoPage } from "@/lib/seo-landing-content";

const key = "remove-truthfinder" as const;

export const metadata: Metadata = buildSeoMetadata(key);

export default function RemoveTruthfinderSeoPage() {
  return <SeoLandingTemplate def={getSeoPage(key)} />;
}
