/** localStorage + sessionStorage keys for growth / lead capture. */
export const STORAGE_LEAD_EMAIL = "pe_lead_email";
/** Prevents re-showing exit modal in the same session after first show. */
export const SESSION_EXIT_INTENT_SHOWN = "pe_exit_intent_shown";
/** JSON payload from the latest exposure scan (dashboard reads this). */
export const STORAGE_SCAN_DATA = "pe_scan_data";
/** Unified scan session (single source of truth for last scan; keyed by `scanId`). */
export const STORAGE_SCAN_SESSION = "pe_scan_session";
/** Simulated account profile after signup (no real auth yet). */
export const STORAGE_USER = "pe_user";
/** "free" | "lifetime" — free users see limited broker status in dashboard. */
export const STORAGE_PLAN = "pe_plan";
/** Paddle checkout origin to attribute upgrade funnel source. */
export const STORAGE_PAYWALL_SOURCE = "pe_paywall_source";
/** Set when user opens the paywall modal (funnel: exposure → paywall). */
export const STORAGE_PAYWALL_INTERACTED = "pe_paywall_interacted";
/** Populated from Paddle `checkout.completed` to prefill signup. */
export const STORAGE_CHECKOUT_EMAIL = "pe_checkout_email";
/** All simulated broker removals complete — dashboard "protected" state. */
export const STORAGE_DASH_PROTECTED = "pe_dash_protected";
/** Set when the Paddle (or CTA) checkout has been opened; cleared on success or explicit reset. */
export const STORAGE_CHECKOUT_STARTED = "pe_checkout_started";
/** Set while on the post-payment signup path; cleared after account creation. */
export const STORAGE_SIGNUP_PENDING = "pe_signup_pending";
/** First-touch acquisition: tiktok | reddit | google | direct. */
export const STORAGE_ACQUISITION_SOURCE = "pe_acquisition_source";
/** Friend referral from ?ref=PE-... until signup completes. */
export const STORAGE_PENDING_REFERRAL = "pe_pending_referral";
/** This device’s shareable code (PE-…), stable for private invite links. */
export const STORAGE_OUTGOING_REFERRAL = "pe_referrer_outgoing_code";
/** Serialized `RemovalEngineState` for opt-out job tracking. */
export const STORAGE_REMOVAL_STATE = "pe_removal_state";
/** Next scheduled monitoring rescan (ISO) + config. */
export const STORAGE_MONITORING = "pe_monitoring_state";
