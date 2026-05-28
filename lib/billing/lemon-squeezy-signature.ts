import crypto from "node:crypto";

/** @see https://docs.lemonsqueezy.com/help/webhooks/signing-requests */
export function verifyLemonSqueezySignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader?.trim() || !secret.trim()) {
    return false;
  }
  const hmac = crypto.createHmac("sha256", secret.trim());
  const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
  const signature = Buffer.from(signatureHeader.trim(), "utf8");
  if (digest.length !== signature.length) {
    return false;
  }
  return crypto.timingSafeEqual(digest, signature);
}
