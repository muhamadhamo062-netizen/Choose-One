/**
 * A/B-style primary conversion labels. Client components should apply after mount
 * to avoid hydration mismatches from randomization.
 */
export const CTA_VARIANTS = [
  "Remove My Data Now",
  "Erase My Data Instantly",
  "Protect My Identity Now"
] as const;

export type CtaVariant = (typeof CTA_VARIANTS)[number];
