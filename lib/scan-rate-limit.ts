import { Redis } from "@upstash/redis";

const DAILY_SCAN_LIMIT = 3;
const WINDOW_SECONDS = 24 * 60 * 60;

let redisClient: Redis | null | undefined;

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

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

function buildDailyBucketKey(ip: string, prefix: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `${prefix}:${day}:${ip}`;
}

export async function enforceRateLimit(
  request: Request,
  options?: { limit?: number; windowSeconds?: number; keyPrefix?: string }
): Promise<{ ok: true } | { ok: false }> {
  const redis = getRedisClient();
  if (!redis) {
    return { ok: true };
  }

  const ip = getClientIp(request);
  const key = buildDailyBucketKey(ip, options?.keyPrefix ?? "rate:scan");
  const limit = options?.limit ?? DAILY_SCAN_LIMIT;
  const ttl = options?.windowSeconds ?? WINDOW_SECONDS;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttl);
  }
  if (count > limit) {
    return { ok: false };
  }
  return { ok: true };
}

export async function enforceScanRateLimit(request: Request): Promise<{ ok: true } | { ok: false }> {
  return enforceRateLimit(request, { keyPrefix: "rate:scan", limit: DAILY_SCAN_LIMIT, windowSeconds: WINDOW_SECONDS });
}
