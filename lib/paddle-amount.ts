/**
 * Best-effort extraction of purchase amount (USD cents) from Paddle webhook `data`.
 * We only need to distinguish the $149 / $199 triggers.
 */
export function getUsdAmountCentsFromPaddleData(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  // Common shapes: data.details.totals.total or data.totals.total
  const candidates: unknown[] = [];

  const totals = o.totals;
  if (totals && typeof totals === "object") candidates.push((totals as any).total, (totals as any).grand_total);

  const details = o.details;
  if (details && typeof details === "object") {
    const dt = (details as any).totals;
    if (dt && typeof dt === "object") candidates.push(dt.total, dt.grand_total);
  }

  // Some payloads use amount fields directly
  candidates.push((o as any).amount, (o as any).total);

  // Try structured money objects first
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === "object") {
      const amount = (c as any).amount ?? (c as any).value;
      const currency = (c as any).currency_code ?? (c as any).currency ?? (c as any).currencyCode;
      if (typeof currency === "string" && currency.toUpperCase() !== "USD") continue;
      if (typeof amount === "string" && /^\d+(\.\d+)?$/.test(amount)) {
        return Math.round(Number(amount) * 100);
      }
      if (typeof amount === "number" && Number.isFinite(amount)) {
        // If already cents, caller will still work for 14900/19900; otherwise dollars.
        return amount > 1000 ? Math.round(amount) : Math.round(amount * 100);
      }
    } else if (typeof c === "string" && /^\d+(\.\d+)?$/.test(c)) {
      return Math.round(Number(c) * 100);
    } else if (typeof c === "number" && Number.isFinite(c)) {
      return c > 1000 ? Math.round(c) : Math.round(c * 100);
    }
  }

  return null;
}

