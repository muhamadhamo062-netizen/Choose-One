/**
 * Data discovery — retrieves publicly available data via configured connectors only.
 * Does NOT generate fake phone numbers, addresses, or broker hits.
 *
 * Production: set `PE_DISCOVERY_CONNECTOR_URL` (+ optional `PE_DISCOVERY_CONNECTOR_TOKEN`) to a
 * compliant service that returns broker/PII fields from real sources. The default path returns
 * only user-submitted non-sensitive fields and empty retrieval arrays.
 */

import type { DiscoveryResult, IdentityDiscoveryInput } from "@/lib/types/discovery";

function normalizeConnectorPayload(body: unknown): DiscoveryResult | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const o = body as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name : "";
  const possibleAddresses = Array.isArray(o.possibleAddresses)
    ? o.possibleAddresses.filter((a): a is string => typeof a === "string")
    : [];
  const phones = Array.isArray(o.phones) ? o.phones.filter((p): p is string => typeof p === "string") : [];
  const emails = Array.isArray(o.emails) ? o.emails.filter((e): e is string => typeof e === "string") : [];
  const brokerSources = Array.isArray(o.brokerSources)
    ? o.brokerSources.filter((b): b is string => typeof b === "string")
    : [];
  const rawConf = o.confidenceScore;
  const normalizedConf =
    typeof rawConf === "number" && rawConf >= 0 && rawConf <= 1
      ? rawConf
      : typeof rawConf === "number" && rawConf > 1 && rawConf <= 100
        ? rawConf / 100
        : 0;
  if (!name) {
    return null;
  }
  return {
    name,
    possibleAddresses,
    phones,
    emails,
    brokerSources,
    confidenceScore: Math.min(1, Math.max(0, normalizedConf)),
    provenance: "connector"
  };
}

/**
 * Fetches discoverable identity signals. Without `PE_DISCOVERY_CONNECTOR_URL`, returns
 * `brokerSources: []` and only echoes user email (if any) in `emails` — that email is
 * not "discovered" but is part of the subject identity for opt-out flows downstream.
 */
export async function discoverIdentity(input: IdentityDiscoveryInput): Promise<DiscoveryResult> {
  const name = input.fullName?.trim() || "Unknown";
  const userEmail = input.email?.trim();
  const url = process.env.PE_DISCOVERY_CONNECTOR_URL;

  if (url) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = process.env.PE_DISCOVERY_CONNECTOR_TOKEN;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          fullName: input.fullName,
          email: userEmail,
          stateCode: input.stateCode,
          stateLabel: input.stateLabel
        }),
        signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(60_000) : undefined
      });
      if (res.ok) {
        const json: unknown = await res.json();
        const parsed = normalizeConnectorPayload(json);
        if (parsed) {
          return parsed;
        }
      }
    } catch {
      // fall through to input-only
    }
  }

  return {
    name,
    possibleAddresses: [],
    phones: [],
    emails: userEmail ? [userEmail] : [],
    brokerSources: [],
    confidenceScore: 0,
    provenance: url ? "input_only" : "no_connector_configured",
    connectorNote: url
      ? "Discovery connector did not return a valid payload."
      : "No discovery connector is configured. Set PE_DISCOVERY_CONNECTOR_URL to retrieve live broker index data."
  };
}
