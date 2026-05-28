import { PrismaClient } from "@prisma/client";

function withConnectTimeout(url: string): string {
  if (/connect_timeout=/i.test(url)) {
    return url;
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connect_timeout=15`;
}

/**
 * Auth + health checks: always use DIRECT_URL (db.*.supabase.co:5432), not the pooler.
 */
export function createDirectPrismaClient(): PrismaClient | null {
  const directUrl = process.env.DIRECT_URL?.trim() ?? "";
  if (!directUrl) {
    return null;
  }
  return new PrismaClient({
    datasources: {
      db: { url: withConnectTimeout(directUrl) }
    },
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"]
  });
}
