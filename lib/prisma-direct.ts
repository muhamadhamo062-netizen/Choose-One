import { PrismaClient } from "@prisma/client";
import { resolveAuthDatabaseUrl } from "@/lib/auth-database-url";
import { ensureSslParam } from "@/lib/supabase-pg-url";

function withConnectTimeout(url: string): string {
  if (/connect_timeout=/i.test(url)) {
    return url;
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connect_timeout=15`;
}

/**
 * Auth + health checks: Session pooler on Vercel; DIRECT_URL locally when available.
 */
export function createAuthPrismaClient(): PrismaClient | null {
  const resolved = resolveAuthDatabaseUrl();
  if (!resolved) {
    return null;
  }
  return new PrismaClient({
    datasources: {
      db: { url: withConnectTimeout(ensureSslParam(resolved.url)) }
    },
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"]
  });
}

/** @deprecated Use createAuthPrismaClient */
export function createDirectPrismaClient(): PrismaClient | null {
  return createAuthPrismaClient();
}
