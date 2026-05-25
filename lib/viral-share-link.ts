import { getPeUser } from "@/lib/scan-storage";

/**
 * Link copied after scan — lands on the homepage scanner with attribution.
 */
export function buildViralScanShareUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }
  const origin = window.location.origin;
  const p = new URLSearchParams();
  p.set("utm_source", "viral_card");
  p.set("utm_medium", "scan_share");
  p.set("utm_campaign", "exposure_report");
  const u = getPeUser();
  if (u?.referralCode) {
    p.set("ref", u.referralCode);
  }
  return `${origin}/?${p.toString()}#scanner`;
}

export function buildTwitterShareUrl(personalUrl: string): string {
  const text = encodeURIComponent(
    "I just checked my data broker exposure — score 94% with 100+ risk signals. Run the free U.S. scan on PrivacyEraser.ai:"
  );
  const url = encodeURIComponent(personalUrl);
  return `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
}
