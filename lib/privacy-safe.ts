import { createHash } from "crypto";

export function hashSensitiveValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function maskEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at <= 1) {
    return "***";
  }
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!domain) {
    return `${local[0]}***`;
  }
  return `${local[0]}***@${domain}`;
}
