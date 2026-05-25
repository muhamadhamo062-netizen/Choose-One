/**
 * Product language guardrails — UI layer only.
 * Backend may use plan / billing-table fields; they must not shape user-facing copy.
 *
 * @see `product-messaging.ts` — `CORE_PRODUCT_COPY` (immutable, locked; direct `COPY` access only in UI)
 * @see `sanitizeProductCopy.ts` — optional legacy input sanitizer (CMS/API)
 */

/** Canonical product philosophy for reviews and onboarding. */
export const PRODUCT_PHILOSOPHY =
  "This is a Lifetime Protection SaaS, not a recurring-billing product." as const;

/** Preferred positive vocabulary for user-facing product text. */
export const ALLOWED_UI_PRODUCT_TERMS = [
  "Lifetime Protection",
  "Permanent Removal",
  "Continuous Monitoring",
  "Data Exposure",
  "Data Broker Removal"
] as const;

/**
 * Phrases that must not appear in UI copy (lowercase for documentation / linting reference).
 * Variants are handled by `sanitizeProductCopy`.
 */
export const FORBIDDEN_UI_PRODUCT_TERMS = [
  "subscription",
  "monthly plan",
  "trial",
  "upgrade plan"
] as const;

export type AllowedUiProductTerm = (typeof ALLOWED_UI_PRODUCT_TERMS)[number];
export type ForbiddenUiProductTerm = (typeof FORBIDDEN_UI_PRODUCT_TERMS)[number];
