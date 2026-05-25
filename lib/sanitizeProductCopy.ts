/**
 * @deprecated Legacy / escape hatch — for **external** or untrusted product-adjacent input only
 * (CMS, API fields, ad-hoc i18n). Do not wrap `CORE_PRODUCT_COPY` or other internal static copy; build-time ESLint
 * (`lint:product`) is the source of truth for the UI. Prefer fixing the source.
 *
 * @see `npm run lint:product` and `eslint-plugin-privacy-eraser`
 */

/**
 * @deprecated For external or legacy inputs only. Internal copy must be authored clean in `product-messaging.ts`.
 */
export function sanitizeProductCopy(text: string): string {
  if (typeof text !== "string" || text.length === 0) {
    return text;
  }
  let s = text;
  s = s.replace(/\bupgrade\s+plans?\b/gi, "Activate Lifetime Protection");
  s = s.replace(/\bmonthly\s+plans?\b/gi, "Lifetime Protection");
  s = s.replace(/\bsubscription\s+active\b/gi, "Lifetime Protection active");
  s = s.replace(/\bplan\s+active\b/gi, "Lifetime Protection active");
  s = s.replace(/\bmonthly\s+plan\b/gi, "Lifetime Protection");
  s = s.replace(/\bsubscriptions\b/gi, "Lifetime Protection");
  s = s.replace(/\bsubscription\b/gi, "Lifetime Protection");
  s = s.replace(/\bfree\s+trial\b/gi, "free privacy scan");
  s = s.replace(/\btrial\b/gi, "scan");
  s = s.replace(/\s{2,}/g, " ");
  return s.trim();
}

/**
 * @deprecated Alias for `sanitizeProductCopy` — use when wiring CMS/headless content later.
 */
export const sanitizeExternalProductInput = sanitizeProductCopy;
