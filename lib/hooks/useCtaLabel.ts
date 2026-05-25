import { useEffect, useState } from "react";
import { CTA_VARIANTS, type CtaVariant } from "@/lib/cta-variants";

const SESSION_KEY = "pe_cta_variant_i";

function readOrCreateVariantIndex(): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const raw = window.sessionStorage.getItem(SESSION_KEY);
  if (raw !== null) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= 0 && n < CTA_VARIANTS.length) {
      return n;
    }
  }
  const idx = Math.floor(Math.random() * CTA_VARIANTS.length);
  window.sessionStorage.setItem(SESSION_KEY, String(idx));
  return idx;
}

/**
 * One variant per session (tab) for consistent A/B messaging across the landing page.
 * First client paint uses the first string; then hydrates to the session value.
 */
export function useCtaLabel(): { label: CtaVariant; isReady: boolean } {
  const [label, setLabel] = useState<CtaVariant>(CTA_VARIANTS[0]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const i = readOrCreateVariantIndex();
    setLabel(CTA_VARIANTS[i] ?? CTA_VARIANTS[0]);
    setIsReady(true);
  }, []);

  return { label, isReady };
}
