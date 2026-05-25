import { FaqSection } from "@/components/sections/FaqSection";
import { HeroSection } from "@/components/sections/HeroSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { LiveBreachTicker } from "@/components/sections/LiveBreachTicker";
import { PricingSection } from "@/components/sections/PricingSection";
import { ScannerSection } from "@/components/sections/ScannerSection";
import { TrustBadgesSection } from "@/components/sections/TrustBadgesSection";

/**
 * Home: scan-first funnel — pricing is paywall-only, not on this page.
 */
export default function HomePage() {
  return (
    <main className="min-h-0 w-full flex-1 overflow-x-hidden">
      <HeroSection />
      <LiveBreachTicker />
      <ScannerSection />
      <PricingSection />
      <TrustBadgesSection />
      <HowItWorksSection />
      <FaqSection />
    </main>
  );
}
