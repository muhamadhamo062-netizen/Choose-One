/**
 * Lemon Squeezy webhook + Checkout.Success payload helpers (JSON:API shape).
 * @see https://docs.lemonsqueezy.com/help/webhooks/event-types
 */

export function getLemonSqueezyEventName(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const meta = (payload as { meta?: { event_name?: string } }).meta;
  return typeof meta?.event_name === "string" ? meta.event_name : null;
}

export function getLemonSqueezyEventId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const meta = (payload as { meta?: { webhook_id?: string; event_name?: string } }).meta;
  if (typeof meta?.webhook_id === "string" && meta.webhook_id) {
    return meta.webhook_id;
  }
  const data = (payload as { data?: { id?: string } }).data;
  if (typeof data?.id === "string" && data.id) {
    return `ls_${data.id}`;
  }
  return null;
}

function readCustomData(obj: unknown): Record<string, unknown> | null {
  if (!obj || typeof obj !== "object") {
    return null;
  }
  const attrs = (obj as { attributes?: { custom_data?: unknown } }).attributes;
  const custom = attrs?.custom_data ?? (obj as { custom_data?: unknown }).custom_data;
  if (custom && typeof custom === "object" && !Array.isArray(custom)) {
    return custom as Record<string, unknown>;
  }
  const meta = (obj as { meta?: { custom_data?: unknown } }).meta?.custom_data;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return meta as Record<string, unknown>;
  }
  return null;
}

export function getOrderIdFromLemonSqueezyPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const data = (payload as { data?: { id?: string } }).data;
  if (typeof data?.id === "string" && data.id.length > 0) {
    return data.id;
  }
  return null;
}

export function getEmailFromLemonSqueezyPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const data = (payload as { data?: { attributes?: { user_email?: string; customer_email?: string } } }).data;
  const attrs = data?.attributes;
  const email = attrs?.user_email ?? attrs?.customer_email;
  if (typeof email === "string" && email.includes("@")) {
    return email.trim().toLowerCase();
  }
  const custom = readCustomData(payload);
  const fromCustom = custom?.email;
  if (typeof fromCustom === "string" && fromCustom.includes("@")) {
    return fromCustom.trim().toLowerCase();
  }
  return null;
}

export function getPublicScanIdFromLemonSqueezyPayload(payload: unknown): string | null {
  const custom = readCustomData(payload);
  if (!custom) {
    return null;
  }
  if (typeof custom.public_scan_id === "string") {
    return custom.public_scan_id.trim();
  }
  if (typeof custom.publicScanId === "string") {
    return custom.publicScanId.trim();
  }
  return null;
}

/** Total in USD cents from order attributes (total_usd or total). */
export function getUsdAmountCentsFromLemonSqueezyPayload(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const attrs = (payload as { data?: { attributes?: { total_usd?: number; total?: number; currency?: string } } })
    .data?.attributes;
  if (!attrs) {
    return null;
  }
  if (typeof attrs.total_usd === "number") {
    return Math.round(attrs.total_usd);
  }
  if (typeof attrs.total === "number") {
    const currency = (attrs.currency ?? "USD").toUpperCase();
    if (currency === "USD") {
      return Math.round(attrs.total);
    }
  }
  return null;
}

export function getOrderIdFromCheckoutSuccessEvent(event: unknown): string | null {
  if (!event || typeof event !== "object") {
    return null;
  }
  const data = (event as { data?: { id?: string } }).data;
  return typeof data?.id === "string" ? data.id : null;
}
