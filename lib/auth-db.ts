import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createDirectPrismaClient } from "@/lib/prisma-direct";
import { getRawSessionSecret } from "@/lib/auth-secret";
import { safeDbResult, type SafeDbResult } from "@/lib/safe-db";
import { isSupabaseEnvUnfinishedTemplate } from "@/lib/validateSupabasePrismaEnv";

export type AuthEnvIssue = "database_not_configured" | "supabase_paste_required" | "session_not_configured";

/** Validates env required for signup/login on Vercel (no .env.local there). */
export function getAuthEnvIssue(): AuthEnvIssue | null {
  const du = process.env.DATABASE_URL?.trim() ?? "";
  const di = process.env.DIRECT_URL?.trim() ?? "";
  if (!du || !di) {
    return "database_not_configured";
  }
  if (isSupabaseEnvUnfinishedTemplate(du, di)) {
    return "supabase_paste_required";
  }
  if (!getRawSessionSecret()) {
    return "session_not_configured";
  }
  return null;
}

/** Production/Vercel: prefer DIRECT_URL — pooler + per-query $connect often fails on serverless. */
function preferDirectFirst(): boolean {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}

type DbOp<T> = (db: PrismaClient) => Promise<T>;

/**
 * Runs a Prisma op for auth flows: direct connection first on Vercel, then pooled client.
 */
export async function runAuthDb<T>(op: DbOp<T>): Promise<SafeDbResult<T>> {
  const direct = createDirectPrismaClient();

  if (preferDirectFirst() && direct) {
    const first = await safeDbResult(() => op(direct));
    await direct.$disconnect().catch(() => undefined);
    if (first.ok) {
      return first;
    }
  }

  const pooled = await safeDbResult(() => op(prisma as unknown as PrismaClient));
  if (pooled.ok || !direct) {
    return pooled;
  }

  const second = await safeDbResult(() => op(direct));
  await direct.$disconnect().catch(() => undefined);
  return second;
}
