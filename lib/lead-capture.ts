import { trackEvent } from "@/lib/analytics";
import { STORAGE_LEAD_EMAIL } from "@/lib/growth-constants";
import { sendExposureReport } from "@/lib/email";

export type LeadSource = "scanner" | "exit_intent";

export interface LeadCapturePayload {
  email: string;
  timestamp: string;
  source: LeadSource;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Persists lead email for downstream automation and logs a structured object (dev-friendly).
 */
export function captureLeadEmail(email: string, source: LeadSource, options: { requestReport?: boolean } = {}): void {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_LEAD_EMAIL, normalized);
  } catch {
    // ignore
  }

  const payload: LeadCapturePayload = {
    email: normalized,
    timestamp: new Date().toISOString(),
    source
  };

  // eslint-disable-next-line no-console
  console.info(
    "%c[PE LeadCapture]",
    "color: #22C55E; font-weight: bold",
    JSON.stringify(payload, null, 0)
  );

  trackEvent({
    name: "email_captured",
    source: source === "exit_intent" ? "exit_intent" : "scanner_report"
  });

  if (options.requestReport) {
    void sendExposureReport(normalized);
  }
}
