import { fetchWithOneRetry } from "@/lib/fetch-with-retry";
import type { LeakProviderResponse, LeakRecord } from "@/services/leakProvider";

function envCredential(key: "DEHASHED_USERNAME" | "DEHASHED_API_KEY"): string | null {
  const v = process.env[key]?.trim();
  return v || null;
}

function toRecord(raw: Record<string, unknown>): LeakRecord {
  const source =
    typeof raw.database_name === "string"
      ? raw.database_name
      : typeof raw.source === "string"
        ? raw.source
        : typeof raw.name === "string"
          ? raw.name
          : "Unknown breach";
  const email = typeof raw.email === "string" ? raw.email : null;
  const username = typeof raw.username === "string" ? raw.username : null;
  const password = typeof raw.password === "string" ? raw.password : null;
  const breachDate =
    typeof raw.obtained === "string"
      ? raw.obtained
      : typeof raw.breach_date === "string"
        ? raw.breach_date
        : typeof raw.date === "string"
          ? raw.date
          : null;
  const ipAddress = typeof raw.ip_address === "string" ? raw.ip_address : null;
  const removeUrl =
    typeof raw.remove_url === "string"
      ? raw.remove_url
      : typeof raw.unsubscribe_url === "string"
        ? raw.unsubscribe_url
        : null;
  return { source, username, email, password, breachDate, ipAddress, removeUrl };
}

export function dehashedCredentialsConfigured(): boolean {
  return Boolean(envCredential("DEHASHED_USERNAME") && envCredential("DEHASHED_API_KEY"));
}

export async function fetchDeHashedBreaches(email: string): Promise<LeakProviderResponse> {
  const username = envCredential("DEHASHED_USERNAME");
  const apiKey = envCredential("DEHASHED_API_KEY");
  if (!username || !apiKey) {
    throw new Error("dehashed_missing_credentials");
  }

  const baseUrl = (process.env.DEHASHED_API_URL ?? "https://api.dehashed.com/search").trim();
  const auth = Buffer.from(`${username}:${apiKey}`).toString("base64");
  const queryUrl = `${baseUrl}?query=${encodeURIComponent(`email:${email.trim().toLowerCase()}`)}`;

  const res = await fetchWithOneRetry(queryUrl, {
    method: "GET",
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    cache: "no-store",
    timeoutMs: 12_000
  });

  if (!res.ok) {
    throw new Error(`dehashed_failed_${res.status}`);
  }

  const data = (await res.json()) as { entries?: unknown[]; total?: number };
  const records = (Array.isArray(data.entries) ? data.entries : [])
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map(toRecord)
    .filter((r) => r.password || r.source);

  return { provider: "dehashed", breaches: records };
}
