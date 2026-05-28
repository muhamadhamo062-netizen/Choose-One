import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/**
 * Single PrismaClient per Node process (Next.js dev HMR, serverless warm instances).
 * Use Supabase *Transaction* pooler on DATABASE_URL with connection_limit=1; DIRECT_URL is for migrate only.
 * @see https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections#connection-pool
 */
const MAX_CONNECT_RETRIES = 3;
const CONNECT_RETRY_DELAY_MS = 450;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

globalForPrisma.prisma = prismaClient;

let connectPromise: Promise<void> | null = null;
let connected = false;

async function connectWithRetry(): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_CONNECT_RETRIES; attempt++) {
    try {
      await prismaClient.$connect();
      connected = true;
      return;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_CONNECT_RETRIES) {
        break;
      }
      await sleep(CONNECT_RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError ?? new Error("Database connection failed after retries.");
}

export async function ensurePrismaConnected(): Promise<void> {
  if (connected) {
    return;
  }
  if (!connectPromise) {
    connectPromise = connectWithRetry().catch((error) => {
      connectPromise = null;
      connected = false;
      throw error;
    });
  }
  return connectPromise;
}

export const prisma = prismaClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        await ensurePrismaConnected();
        return query(args);
      }
    }
  }
});
