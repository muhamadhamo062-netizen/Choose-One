export type AffiliateRange = "7d" | "30d" | "all";

export function parseAffiliateRange(raw: string | null): AffiliateRange {
  if (raw === "7d" || raw === "30d" || raw === "all") {
    return raw;
  }
  return "30d";
}

export function sinceFromRange(range: AffiliateRange): Date | null {
  if (range === "all") {
    return null;
  }
  const days = range === "7d" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
