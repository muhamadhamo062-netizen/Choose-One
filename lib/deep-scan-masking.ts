/** Server-side masking for free-tier deep scan responses (legal + conversion). */

export function maskPasswordForDisplay(password: string): string {
  const p = password.trim();
  if (!p) {
    return "";
  }
  if (p.length <= 4) {
    return "*".repeat(p.length);
  }
  const head = p.slice(0, 2);
  const tail = p.slice(-2);
  const stars = "*".repeat(Math.max(4, p.length - 4));
  return `${head}${stars}${tail}`;
}

export function maskPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) {
    return "+1 (***) ***-****";
  }
  const last2 = digits.slice(-2);
  const normalized =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits.length >= 10 ? digits.slice(-10) : digits;
  const area = normalized.length >= 10 ? normalized.slice(0, 3) : "555";
  return `+1 (${area}) ***-**${last2}`;
}

export function maskStreetForDisplay(street: string): string {
  const trimmed = street.trim();
  if (!trimmed) {
    return "****";
  }
  const parts = trimmed.split(/\s+/);
  const number = parts[0] ?? "";
  const rest = parts.slice(1).join(" ").trim();
  if (/^\d+/.test(number)) {
    const visible = number.slice(0, 2);
    return `${visible}** ${rest || "St"}`.trim();
  }
  return `** ${parts[parts.length - 1] ?? "St"}`.trim();
}

export function maskAddressLine(street: string, city: string, state: string): string {
  const maskedStreet = maskStreetForDisplay(street);
  const loc = [city.trim(), state.trim()].filter(Boolean).join(", ");
  return loc ? `${maskedStreet}, ${loc}` : maskedStreet;
}

export function maskDarkWebPreview(text: string, maxLen = 220): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) {
    return "";
  }
  if (t.length <= maxLen) {
    return t.slice(0, 3) + "*".repeat(Math.max(8, t.length - 5)) + t.slice(-2);
  }
  const head = t.slice(0, 24);
  const tail = t.slice(-12);
  return `${head}${"*".repeat(12)}${tail}`;
}
