import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies Paddle Billing `Paddle-Signature` (ts + h1) over the raw request body. Do not parse JSON first.
 * @see https://developer.paddle.com/webhooks/signature-verification
 */
export function parsePaddleSignatureHeader(header: string | null): { ts: string; h1: string } | null {
  if (!header || !header.trim()) {
    return null;
  }
  let ts = "";
  let h1 = "";
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) {
      continue;
    }
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === "ts") {
      ts = v;
    } else if (k === "h1" && !h1) {
      h1 = v;
    }
  }
  if (!ts || !h1) {
    return null;
  }
  return { ts, h1 };
}

export function verifyPaddleSignature(rawBody: string, header: string | null, secret: string): boolean {
  const parsed = parsePaddleSignatureHeader(header);
  if (!parsed) {
    return false;
  }
  const signedPayload = `${parsed.ts}:${rawBody}`;
  const expected = createHmac("sha256", secret.trim()).update(signedPayload).digest("hex");
  const got = parsed.h1.trim().toLowerCase();
  const exp = expected.toLowerCase();
  if (exp.length !== got.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(exp, "utf8"), Buffer.from(got, "utf8"));
}
