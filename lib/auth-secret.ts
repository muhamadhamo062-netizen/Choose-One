const DEV_FALLBACK = "dev-only-pe-secret-min-32-chars-rotate-please!!" as const;

/**
 * Single source for SESSION_SECRET resolution (Node + Edge / middleware).
 * Never throw from getRawSessionSecret — callers decide 401 vs 503.
 * Production: prefer 32+ chars (set SESSION_SECRET in .env / hosting).
 */
export function getRawSessionSecret(): string | null {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  const minLen = 32;
  if (fromEnv && fromEnv.length >= minLen) {
    return fromEnv;
  }
  if (process.env.NODE_ENV === "development") {
    return DEV_FALLBACK.length >= 16 ? DEV_FALLBACK : null;
  }
  return null;
}

export function getSessionSecretBytesOrThrow(): Uint8Array {
  const s = getRawSessionSecret();
  if (!s) {
    throw new Error("SESSION_SECRET must be set: use 32+ characters in production (see .env.example)");
  }
  return new TextEncoder().encode(s);
}
