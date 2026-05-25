import { Redis } from "@upstash/redis";

const DEFAULT_PROVIDER = "leakcheck";
const CACHE_TTL_SECONDS = 24 * 60 * 60;

export type LeakProviderName = "leakcheck" | "dehashed";

export interface LeakRecord {
  source: string;
  username: string | null;
  email: string | null;
  password: string | null;
  breachDate: string | null;
  ipAddress: string | null;
  removeUrl: string | null;
}

export interface LeakProviderResponse {
  provider: LeakProviderName;
  breaches: LeakRecord[];
}

type CacheEntry = {
  value: LeakProviderResponse;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheEntry>();
let redisClient: Redis | null | undefined;

function getProvider(): LeakProviderName {
  const raw = (process.env.LEAK_PROVIDER ?? DEFAULT_PROVIDER).trim().toLowerCase();
  return raw === "dehashed" ? "dehashed" : "leakcheck";
}

function getProviderOrder(): LeakProviderName[] {
  const primary = getProvider();
  return primary === "dehashed" ? ["dehashed", "leakcheck"] : ["leakcheck", "dehashed"];
}

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisClient = null;
    return redisClient;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

function buildCacheKey(email: string): string {
  return `cache:deep-scan:${email.toLowerCase()}`;
}

function toRecord(raw: Record<string, unknown>): LeakRecord {
  const source = typeof raw.source === "string" ? raw.source : typeof raw.name === "string" ? raw.name : "Unknown source";
  const email = typeof raw.email === "string" ? raw.email : null;
  const username = typeof raw.username === "string" ? raw.username : null;
  const password = typeof raw.password === "string" ? raw.password : null;
  const breachDate = typeof raw.breach_date === "string" ? raw.breach_date : typeof raw.date === "string" ? raw.date : null;
  const ipAddress = typeof raw.ip_address === "string" ? raw.ip_address : null;
  const removeUrl =
    typeof raw.remove_url === "string"
      ? raw.remove_url
      : typeof raw.unsubscribe_url === "string"
      ? raw.unsubscribe_url
      : null;
  return { source, username, email, password, breachDate, ipAddress, removeUrl };
}

async function fetchLeakCheck(email: string): Promise<LeakProviderResponse> {
  const baseUrl = process.env.LEAKCHECK_API_URL ?? "https://leakcheck.io/api/public";
  const apiKey = process.env.LEAKCHECK_API_KEY;
  if (!apiKey) {
    throw new Error("leakcheck_missing_credentials");
  }
  const params = new URLSearchParams({ check: email });
  if (apiKey) {
    // Keep compatibility with both header-based and query-param based LeakCheck plans.
    params.set("key", apiKey);
  }
  const url = `${baseUrl}?${params.toString()}`;
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  const res = await fetch(url, { method: "GET", headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`leakcheck_failed_${res.status}`);
  }
  const data = (await res.json()) as { result?: unknown[]; sources?: unknown[] };
  const records = (Array.isArray(data.result) ? data.result : Array.isArray(data.sources) ? data.sources : [])
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map(toRecord);
  return { provider: "leakcheck", breaches: records };
}

async function fetchDeHashed(email: string): Promise<LeakProviderResponse> {
  const baseUrl = process.env.DEHASHED_API_URL ?? "https://api.dehashed.com/search";
  const username = process.env.DEHASHED_USERNAME;
  const apiKey = process.env.DEHASHED_API_KEY;
  if (!username || !apiKey) {
    throw new Error("dehashed_missing_credentials");
  }

  const auth = Buffer.from(`${username}:${apiKey}`).toString("base64");
  const queryUrl = `${baseUrl}?query=${encodeURIComponent(`email:${email}`)}`;
  const res = await fetch(queryUrl, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`
    },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`dehashed_failed_${res.status}`);
  }

  const data = (await res.json()) as { entries?: unknown[] };
  const records = (Array.isArray(data.entries) ? data.entries : [])
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map(toRecord);
  return { provider: "dehashed", breaches: records };
}

async function fetchWithProvider(provider: LeakProviderName, email: string): Promise<LeakProviderResponse> {
  if (provider === "dehashed") {
    return fetchDeHashed(email);
  }
  return fetchLeakCheck(email);
}

function normalizeEmail(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("invalid_email");
  }
  return normalizedEmail;
}

export async function getCachedBreaches(email: string): Promise<LeakProviderResponse | null> {
  const normalizedEmail = normalizeEmail(email);
  const key = buildCacheKey(normalizedEmail);
  const redis = getRedisClient();
  if (redis) {
    const cached = await redis.get<LeakProviderResponse>(key);
    if (cached && Array.isArray(cached.breaches)) {
      return cached;
    }
  }

  const inMemory = memoryCache.get(key);
  if (!inMemory) {
    return null;
  }
  if (Date.now() > inMemory.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return inMemory.value;
}

export async function setCachedBreaches(email: string, value: LeakProviderResponse): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const key = buildCacheKey(normalizedEmail);
  const ttl = Number(process.env.LEAK_CACHE_TTL_SECONDS || CACHE_TTL_SECONDS);
  const redis = getRedisClient();
  if (redis) {
    await redis.set(key, value, { ex: ttl });
    return;
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
}

export async function fetchRealBreaches(email: string): Promise<LeakProviderResponse> {
  const normalizedEmail = normalizeEmail(email);

  const providers = getProviderOrder();
  const errors: string[] = [];
  let lastEmptyResult: LeakProviderResponse | null = null;

  for (const provider of providers) {
    try {
      const response = await fetchWithProvider(provider, normalizedEmail);
      if (response.breaches.length > 0) {
        return response;
      }
      lastEmptyResult = response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_provider_error";
      errors.push(`${provider}:${message}`);
    }
  }

  if (lastEmptyResult) {
    return lastEmptyResult;
  }
  throw new Error(`all_providers_failed:${errors.join("|")}`);
}
