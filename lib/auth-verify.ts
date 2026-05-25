import { jwtVerify } from "jose";
import { getRawSessionSecret } from "@/lib/auth-secret";

/**
 * Verifies `pe_session` JWT (HS256) from the same issuer as `signSessionToken` / `signJwtHS256`.
 * Returns `sub` (user id) or null — never throws.
 */
export async function verifyPeSessionJwt(token: string): Promise<{ sub: string } | null> {
  const secret = getRawSessionSecret();
  if (!secret) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    const sub = payload.sub;
    return typeof sub === "string" && sub.length > 0 ? { sub } : null;
  } catch {
    return null;
  }
}
