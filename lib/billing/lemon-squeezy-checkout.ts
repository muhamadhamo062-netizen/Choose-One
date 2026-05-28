/**
 * Build hosted / overlay checkout URLs for Lemon Squeezy.
 * @see https://docs.lemonsqueezy.com/help/checkout/passing-custom-data
 */

export function isLemonSqueezyCheckoutConfigured(): boolean {
  if (process.env.NEXT_PUBLIC_LEMON_SQUEEZY_CHECKOUT_URL?.trim()) {
    return true;
  }
  return Boolean(
    process.env.NEXT_PUBLIC_LEMON_SQUEEZY_VARIANT_ID?.trim() &&
      process.env.NEXT_PUBLIC_LEMON_SQUEEZY_STORE_SLUG?.trim()
  );
}

export function buildLemonSqueezyCheckoutUrl(input: { email?: string; publicScanId?: string }): string | null {
  const direct = process.env.NEXT_PUBLIC_LEMON_SQUEEZY_CHECKOUT_URL?.trim();
  const variantId = process.env.NEXT_PUBLIC_LEMON_SQUEEZY_VARIANT_ID?.trim();
  const storeSlug = process.env.NEXT_PUBLIC_LEMON_SQUEEZY_STORE_SLUG?.trim();

  let url: URL;
  if (direct) {
    try {
      url = new URL(direct);
    } catch {
      return null;
    }
  } else if (variantId && storeSlug) {
    url = new URL(`https://${storeSlug}.lemonsqueezy.com/checkout/buy/${variantId}`);
  } else {
    return null;
  }

  if (input.email) {
    url.searchParams.set("checkout[email]", input.email);
  }
  if (input.publicScanId) {
    url.searchParams.set("checkout[custom][public_scan_id]", input.publicScanId);
  }
  return url.toString();
}
