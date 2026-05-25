import { PrismaClient } from "@prisma/client";

/**
 * Emergency fallback client that uses DIRECT_URL explicitly.
 * This bypasses pooler-related failures for critical auth flows.
 */
export function createDirectPrismaClient(): PrismaClient | null {
  const directUrl = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
  if (!directUrl) {
    return null;
  }
  return new PrismaClient({
    datasources: {
      db: { url: directUrl }
    },
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"]
  });
}
