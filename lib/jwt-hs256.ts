import { createHmac, timingSafeEqual } from "crypto";

function b64urlEncodeBytes(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlEncodeJson(obj: unknown): string {
  return b64urlEncodeBytes(Buffer.from(JSON.stringify(obj), "utf8"));
}

function b64urlDecodeToBuffer(s: string): Buffer | null {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  try {
    return Buffer.from(b, "base64");
  } catch {
    return null;
  }
}

/**
 * Minimal HS256 JWT (no external deps). Same shape as `jose` would produce for our session use.
 */
export function signJwtHS256(
  payload: Record<string, unknown>,
  secret: Uint8Array | string,
  expiresInSec: number
): string {
  const key = typeof secret === "string" ? secret : Buffer.from(secret);
  const header = b64urlEncodeJson({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const body = b64urlEncodeJson({
    ...payload,
    iat: now,
    exp: now + expiresInSec
  });
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", key).update(data).digest();
  return `${data}.${b64urlEncodeBytes(sig)}`;
}

export function verifyJwtHS256(token: string, secret: Uint8Array | string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [h, p, s] = parts;
  const key = typeof secret === "string" ? secret : Buffer.from(secret);
  const data = `${h}.${p}`;
  const expected = createHmac("sha256", key).update(data).digest();
  const sigBuf = b64urlDecodeToBuffer(s);
  if (!sigBuf || sigBuf.length !== expected.length || !timingSafeEqual(sigBuf, expected)) {
    return null;
  }
  let payload: unknown;
  try {
    const raw = b64urlDecodeToBuffer(p);
    if (!raw) {
      return null;
    }
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const o = payload as { exp?: number };
  if (typeof o.exp === "number" && Math.floor(Date.now() / 1000) >= o.exp) {
    return null;
  }
  return payload as Record<string, unknown>;
}
