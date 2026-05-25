/**
 * Unverified client-triggered entitlements (Paddle `checkout.completed` → REST) are unsafe
 * in production. Production uses: Paddle webhook + POST /api/user/session-from-transaction.
 */

export function isProductionNodeEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Post-checkout user creation + lifetime grant; allow in prod only when explicitly enabled. */
export function allowUnverifiedCompletePurchase(): boolean {
  if (!isProductionNodeEnv()) {
    return true;
  }
  return (
    process.env.PE_ALLOW_UNVERIFIED_COMPLETE_PURCHASE === "true" ||
    process.env.PE_ALLOW_UNVERIFIED_COMPLETE_PURCHASE === "1"
  );
}

/**
 * Session-scoped subscription upgrade with no payment proof. Dev / staging / explicit prod escape hatch.
 */
export function allowUnverifiedActivateLifetime(): boolean {
  if (!isProductionNodeEnv()) {
    return true;
  }
  return (
    process.env.PE_ALLOW_UNVERIFIED_ACTIVATE_LIFETIME === "true" ||
    process.env.PE_ALLOW_UNVERIFIED_ACTIVATE_LIFETIME === "1"
  );
}

/** Webhook secret + DB are required; in production, SESSION_SECRET (≥16) must be set so signSessionToken cannot throw. */
export function isVerifiedPaymentSystemConfigured(): boolean {
  if (!process.env.PADDLE_WEBHOOK_SECRET?.trim() || !process.env.DATABASE_URL?.trim()) {
    return false;
  }
  if (isProductionNodeEnv()) {
    const s = process.env.SESSION_SECRET?.trim() ?? "";
    return s.length >= 16;
  }
  return true;
}

export function isProductionPaymentBlocked(): boolean {
  return isProductionNodeEnv() && !isVerifiedPaymentSystemConfigured();
}
