/**
 * Human-readable title from a URL segment like "spokeo" or "been-verified".
 */
export function brokerTitleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
