/**
 * Single source for httpOnly auth cookie names (middleware + Route Handlers + client docs).
 * Do not rename without a migration — existing browsers only send `pe_session`.
 */
export const SESSION_COOKIE = "pe_session";
export const PENDING_SCAN_COOKIE = "pe_pending_scan_id";
export const AFFILIATE_REF_COOKIE = "pe_aff_ref";
export const AFFILIATE_SESSION_COOKIE = "pe_aff_session";
