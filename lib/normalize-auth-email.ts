/** Strip invisible / bidi chars (common when pasting Arabic emails) and normalize for auth lookups. */
export function normalizeAuthEmail(raw: string): string {
  return raw
    .normalize("NFKC")
    .trim()
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u00A0]/g, "")
    .toLowerCase();
}
