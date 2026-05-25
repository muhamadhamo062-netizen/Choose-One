import { getPeUser, savePeUser } from "@/lib/scan-storage";
import type { PeUser } from "@/types/funnel";

const CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Opaque, human-shareable code (e.g. PE-A1B2C3D4).
 */
export function generateReferralCode(): string {
  let s = "PE-";
  for (let i = 0; i < 8; i += 1) {
    s += CHARS[Math.floor(Math.random() * CHARS.length)]!;
  }
  return s;
}

export function withReferralCode(user: PeUser, existing?: string | null): PeUser {
  if (user.referralCode) {
    return user;
  }
  return { ...user, referralCode: existing && existing.length > 0 ? existing : generateReferralCode() };
}

/** Backfills a referral code for existing accounts that predate the field. */
export function ensureUserReferralInStorage(): string | null {
  const u = getPeUser();
  if (!u) {
    return null;
  }
  if (u.referralCode) {
    return u.referralCode;
  }
  const next = withReferralCode(u);
  savePeUser(next);
  return next.referralCode ?? null;
}
