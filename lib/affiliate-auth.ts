import { cookies } from "next/headers";
import { signJwtHS256, verifyJwtHS256 } from "@/lib/jwt-hs256";
import { getRawSessionSecret, getSessionSecretBytesOrThrow } from "@/lib/auth-secret";
import { AFFILIATE_SESSION_COOKIE } from "@/lib/auth-cookie-constants";

const PRIMARY_ADMIN_EMAIL = "muhamadhamo062@gmail.com";

type AffiliateTokenPayload = {
  sub: string;
  role: "affiliate";
};

function cookieSecure(): boolean {
  if (process.env.SESSION_COOKIE_INSECURE === "1") {
    return false;
  }
  if (process.env.NODE_ENV !== "production") {
    return false;
  }
  return true;
}

export function affiliateSessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  };
}

export function affiliateRefCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  };
}

export async function signAffiliateSessionToken(affiliateId: string): Promise<string> {
  const secret = getSessionSecretBytesOrThrow();
  return signJwtHS256({ sub: affiliateId, role: "affiliate" }, secret, 60 * 60 * 24 * 7);
}

export async function getAffiliateIdFromCookie(): Promise<string | null> {
  const rawSecret = getRawSessionSecret();
  if (!rawSecret) {
    return null;
  }
  const token = cookies().get(AFFILIATE_SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  const payload = verifyJwtHS256(token, rawSecret) as AffiliateTokenPayload | null;
  if (!payload || payload.role !== "affiliate" || typeof payload.sub !== "string") {
    return null;
  }
  return payload.sub;
}

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? PRIMARY_ADMIN_EMAIL;
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  if (!parsed.includes(PRIMARY_ADMIN_EMAIL)) {
    parsed.push(PRIMARY_ADMIN_EMAIL);
  }
  return [PRIMARY_ADMIN_EMAIL, ...parsed.filter((email) => email !== PRIMARY_ADMIN_EMAIL)];
}

export function isPrimaryAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
}
