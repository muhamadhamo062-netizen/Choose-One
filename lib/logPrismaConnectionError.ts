import { Prisma } from "@prisma/client";
import { getPrismaConnectionFailureHint } from "@/lib/prismaConnectionHint";

/**
 * Server logs: line 1 = exact Prisma/driver message; line 2 = one operator hint.
 * No password or full URL in logs.
 */
export function logPrismaConnectionError(context: string, e: unknown): void {
  const code = typeof (e as { code?: string })?.code === "string" ? (e as { code: string }).code : "";
  const name = e instanceof Error ? e.name : "";
  const message = e instanceof Error ? e.message : String(e);
  console.error(`[${context}] PRISMA_RAW`, code ? `code=${code}` : "", name, message);
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`[${context}] PRISMA_META`, JSON.stringify(e.meta));
  }
  console.error(`[${context}] HINT`, getPrismaConnectionFailureHint(e));
}

/** Only in development — optional fields for API JSON when DB is unreachable (no secrets). */
export function devPrismaConnectionFields(e: unknown): { prisma_code?: string; prisma_message: string } | undefined {
  if (process.env.NODE_ENV !== "development") {
    return undefined;
  }
  const prisma_message = e instanceof Error ? e.message : String(e);
  const code = typeof (e as { code?: string })?.code === "string" ? (e as { code: string }).code : undefined;
  return code ? { prisma_code: code, prisma_message } : { prisma_message };
}
