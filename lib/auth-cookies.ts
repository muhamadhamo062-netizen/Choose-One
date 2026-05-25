import { cookies } from "next/headers";
import { signJwtHS256 } from "@/lib/jwt-hs256";
import { getSessionSecretBytesOrThrow, getRawSessionSecret } from "@/lib/auth-secret";
import { verifyPeSessionJwt } from "@/lib/auth-verify";
import { PENDING_SCAN_COOKIE, SESSION_COOKIE } from "@/lib/auth-cookie-constants";

export { PENDING_SCAN_COOKIE, SESSION_COOKIE } from "@/lib/auth-cookie-constants";

/** Non-production and SESSION_COOKIE_INSECURE=1 use non-Secure cookies (required for http://). */
function sessionCookieSecure(): boolean {
  if (process.env.SESSION_COOKIE_INSECURE === "1") return false;
  if (process.env.NODE_ENV !== "production") return false;
  return true;
}

export async function signSessionToken(userId: string): Promise<string> {
  const secret = getSessionSecretBytesOrThrow();
  return signJwtHS256({ sub: userId }, secret, 60 * 60 * 24 * 7);
}

/** Verify JWT string; public for tests / rare direct checks. */
export async function verifySessionToken(token: string): Promise<string | null> {
  const v = await verifyPeSessionJwt(token);
  return v?.sub ?? null;
}

/**
 * Resolves the logged-in user id from `pe_session` (httpOnly). Never throws.
 * Missing/invalid token → null. Missing app secret in production → null (use getSession() for 503).
 */
export async function getSessionUserIdFromCookies(): Promise<string | null> {
  if (!getRawSessionSecret()) {
    return null;
  }
  const jar = cookies();
  const t = jar.get(SESSION_COOKIE)?.value;
  if (!t) {
    return null;
  }
  return verifySessionToken(t);
}

/**
 * Matches: cookies().set("pe_session", token, { httpOnly, sameSite, secure, path }) + maxAge for persistence.
 * All call sites use SESSION_COOKIE + sessionCookieOptions().
 */
export function sessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  };
}

export function pendingScanCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  };
}
