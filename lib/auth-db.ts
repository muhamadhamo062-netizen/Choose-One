import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createDirectPrismaClient } from "@/lib/prisma-direct";
import { getRawSessionSecret } from "@/lib/auth-secret";
import { logPrismaConnectionError } from "@/lib/logPrismaConnectionError";
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

function isServerlessProd(): boolean {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}

type DbOp<T> = (db: PrismaClient) => Promise<T>;

async function withDirectClient<T>(op: DbOp<T>): Promise<SafeDbResult<T>> {
  const direct = createDirectPrismaClient();
  if (!direct) {
    return { ok: false };
  }
  try {
    await direct.$connect();
    const value = await op(direct);
    return { ok: true, value };
  } catch (e) {
    logPrismaConnectionError("auth-db:direct", e);
    return { ok: false };
  } finally {
    await direct.$disconnect().catch(() => undefined);
  }
}

/**
 * Runs a Prisma op for signup/login. On Vercel: **direct** Postgres only (pooler breaks serverless auth).
 */
export async function runAuthDb<T>(op: DbOp<T>): Promise<SafeDbResult<T>> {
  if (isServerlessProd()) {
    return withDirectClient(op);
  }

  const direct = createDirectPrismaClient();
  if (direct) {
    const first = await withDirectClient(op);
    if (first.ok) {
      return first;
    }
  }

  return safeDbResult(() => op(prisma as unknown as PrismaClient));
}

/** Used by /api/health/auth — same path as signup lookup. */
export async function pingAuthDatabase(): Promise<
  | { ok: true; latencyMs: number; via: "direct" }
  | { ok: false; issue: AuthEnvIssue | "database_unavailable"; prismaCode?: string }
> {
  const envIssue = getAuthEnvIssue();
  if (envIssue) {
    return { ok: false, issue: envIssue };
  }

  const started = Date.now();
  const ping = await withDirectClient((db) => db.$queryRaw(Prisma.sql`SELECT 1 AS ok`));
  if (!ping.ok) {
    return { ok: false, issue: "database_unavailable" };
  }

  return { ok: true, latencyMs: Date.now() - started, via: "direct" };
}
