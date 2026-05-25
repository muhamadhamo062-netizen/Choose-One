/**
 * Defensive field extraction for Paddle Billing webhook `data` and checkout.js `event.data` payloads.
 */

export function getTransactionIdFromPaddleData(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const o = data as Record<string, unknown>;
  if (typeof o.id === "string" && o.id.length > 0) {
    return o.id;
  }
  if (typeof o.transaction_id === "string") {
    return o.transaction_id;
  }
  const t = o.transaction;
  if (t && typeof t === "object") {
    const id = (t as { id?: string }).id;
    if (typeof id === "string") {
      return id;
    }
  }
  return null;
}

function readEmail(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") {
    return null;
  }
  const e = (obj as { email?: unknown }).email;
  if (typeof e === "string" && e.includes("@")) {
    return e.trim().toLowerCase();
  }
  return null;
}

/**
 * Webhook/transaction `data` may include billing, custom_data, or inline customer.
 */
export function getEmailFromPaddleData(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const o = data as Record<string, unknown>;
  const b = o.billing_details;
  if (b) {
    const e = readEmail(b);
    if (e) {
      return e;
    }
  }
  const c = o.custom_data;
  if (c && typeof c === "object") {
    const e = (c as { email?: string }).email;
    if (typeof e === "string" && e.includes("@")) {
      return e.trim().toLowerCase();
    }
  }
  const cu = o.customer;
  if (cu && typeof cu === "object") {
    const e = readEmail(cu);
    if (e) {
      return e;
    }
  }
  return null;
}

export function getPublicScanIdFromPaddleData(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const o = data as Record<string, unknown>;
  const c = o.custom_data;
  if (!c || typeof c !== "object") {
    return null;
  }
  const cd = c as Record<string, unknown>;
  if (typeof cd.public_scan_id === "string") {
    return cd.public_scan_id.trim();
  }
  if (typeof cd.publicScanId === "string") {
    return cd.publicScanId.trim();
  }
  return null;
}
