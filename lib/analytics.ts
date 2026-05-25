/**
 * Development-friendly event tracking. Replace with PostHog / Segment in production.
 */

import { getStateAnalyticsContext, refreshStateAnalyticsContext } from "@/lib/analytics-state";
import type { AcquisitionSource } from "@/lib/acquisition-source";
import type { UserState } from "@/lib/global-user-state";

export type PaywallSource = "scanner" | "dashboard";

export type CtaSurface = "hero" | "scanner" | "dashboard" | "other";

export type AnalyticsEvent =
  | { name: "scan_started"; acquisition_source: AcquisitionSource }
  | {
      name: "scan_completed";
      scanId: string;
      exposure_score: string;
      broker_count: string;
      us_state: string;
      risk_level: string;
    }
  | {
      name: "risk_calculated";
      scanId: string;
      exposure_score: string;
      broker_count: string;
      us_state: string;
      risk_level: string;
    }
  | { name: "removal_started"; exposure_score: string; broker_count: string; us_state: string }
  | { name: "email_captured"; source: "scanner_report" | "exit_intent" }
  | { name: "checkout_clicked" }
  | { name: "paywall_opened"; source: PaywallSource }
  | { name: "paywall_viewed"; source: PaywallSource }
  | { name: "paywall_cta_clicked"; source: PaywallSource }
  | { name: "view_full_report_clicked"; source: PaywallSource }
  | {
      name: "payment_started";
      source: PaywallSource;
      exposure_score: string;
      broker_count: string;
      us_state: string;
    }
  | {
      name: "payment_completed";
      source: PaywallSource;
      exposure_score: string;
      broker_count: string;
      us_state: string;
    }
  | {
      name: "payment_failed";
      source: PaywallSource;
      exposure_score: string;
      broker_count: string;
      us_state: string;
      reason: string;
    }
  | { name: "plan_upgraded"; source: PaywallSource }
  | {
      name: "signup_completed";
      source: "post_payment" | "organic" | "scan";
      acquisition_source: AcquisitionSource;
      scanId: string;
    }
  | { name: "exit_intent_shown" }
  | { name: "exit_intent_submitted" }
  | { name: "state_changed"; state: UserState; previous: UserState; reason: string }
  | { name: "funnel_stage_entered"; stage: UserState; previous: UserState; reason: string }
  | { name: "funnel_milestone"; milestone: string; state: UserState }
  | { name: "scan_complete_modal_shown"; state: UserState; exposures: string }
  | { name: "dashboard_viewed"; state: UserState; exposureScore: string; scanId: string }
  | { name: "signup_viewed"; state: UserState; from: string }
  | { name: "payment_clicked_from_dashboard"; state: UserState }
  | { name: "CTA_clicked_by_state"; cta: string; state: UserState; surface: CtaSurface }
  | { name: "install_prompt_shown"; surface: "banner" | "floating" | "ios_sheet" }
  | { name: "install_clicked"; surface: "banner" | "floating" | "ios_sheet" }
  | { name: "install_dismissed"; surface: "banner" | "floating" | "ios_sheet" }
  | { name: "install_completed" }
  | { name: "referral_panel_viewed"; surface: "scan_result" | "paywall" }
  | { name: "referral_link_copied"; ref_code: string; surface: "scan_result" | "paywall" }
  | { name: "referral_shared_sms"; ref_code: string; surface: "scan_result" | "paywall" }
  | { name: "referral_shared_email"; ref_code: string; surface: "scan_result" | "paywall" }
  | { name: "referral_conversion"; referrer_code: string; scanId: string };

function payload(event: AnalyticsEvent): Record<string, string> {
  const base: Record<string, string> = { event: event.name, ts: new Date().toISOString() };
  if (typeof window !== "undefined") {
    const { server_state, client_state, resolved_state } = getStateAnalyticsContext();
    base.server_state = String(server_state);
    base.client_state = String(client_state);
    base.resolved_state = String(resolved_state);
  }
  if (event.name === "scan_started") {
    base.acquisition_source = event.acquisition_source;
  }
  if (event.name === "scan_completed" || event.name === "risk_calculated") {
    base.scanId = event.scanId;
    base.exposure_score = event.exposure_score;
    base.broker_count = event.broker_count;
    base.us_state = event.us_state;
    base.risk_level = event.risk_level;
  }
  if (event.name === "removal_started") {
    base.exposure_score = event.exposure_score;
    base.broker_count = event.broker_count;
    base.us_state = event.us_state;
  }
  if (event.name === "email_captured") {
    base.source = event.source;
  }
  if (event.name === "view_full_report_clicked") {
    base.source = event.source;
  }
  if (event.name === "payment_started" || event.name === "payment_completed" || event.name === "payment_failed") {
    base.source = event.source;
    base.exposure_score = event.exposure_score;
    base.broker_count = event.broker_count;
    base.us_state = event.us_state;
  }
  if (event.name === "payment_failed") {
    base.reason = event.reason;
  }
  if (
    event.name === "paywall_opened" ||
    event.name === "paywall_viewed" ||
    event.name === "paywall_cta_clicked" ||
    event.name === "plan_upgraded"
  ) {
    base.source = event.source;
  }
  if (event.name === "signup_completed") {
    base.source = event.source;
    base.acquisition_source = event.acquisition_source;
    base.scanId = event.scanId;
  }
  if (event.name === "state_changed") {
    base.state = event.state;
    base.previous = event.previous;
    base.reason = event.reason;
  }
  if (event.name === "funnel_stage_entered") {
    base.stage = event.stage;
    base.previous = event.previous;
    base.reason = event.reason;
  }
  if (event.name === "CTA_clicked_by_state") {
    base.cta = event.cta;
    base.state = event.state;
    base.surface = event.surface;
  }
  if (event.name === "funnel_milestone") {
    base.milestone = event.milestone;
    base.state = event.state;
  }
  if (event.name === "scan_complete_modal_shown") {
    base.state = event.state;
    base.exposures = event.exposures;
  }
  if (event.name === "dashboard_viewed") {
    base.state = event.state;
    base.exposureScore = event.exposureScore;
    base.scanId = event.scanId;
  }
  if (event.name === "payment_clicked_from_dashboard") {
    base.state = event.state;
  }
  if (event.name === "signup_viewed") {
    base.state = event.state;
    base.from = event.from;
  }
  if (
    event.name === "install_prompt_shown" ||
    event.name === "install_clicked" ||
    event.name === "install_dismissed"
  ) {
    base.surface = event.surface;
  }
  if (event.name === "install_completed") {
    // no extra fields
  }
  if (event.name === "referral_panel_viewed") {
    base.surface = event.surface;
  }
  if (
    event.name === "referral_link_copied" ||
    event.name === "referral_shared_sms" ||
    event.name === "referral_shared_email"
  ) {
    base.ref_code = event.ref_code;
    base.surface = event.surface;
  }
  if (event.name === "referral_conversion") {
    base.referrer_code = event.referrer_code;
    base.scanId = event.scanId;
  }
  return base;
}

function forwardEventToServer(p: Record<string, string>): void {
  if (typeof window === "undefined") {
    return;
  }
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p)
  }).catch(() => {
    // ignore
  });
}

export function trackEvent(event: AnalyticsEvent): void {
  if (typeof window === "undefined") {
    return;
  }
  refreshStateAnalyticsContext();
  const p = payload(event);
  // eslint-disable-next-line no-console -- replace with PostHog / Segment
  console.info("[PE Analytics]", p);
  forwardEventToServer(p);
}
