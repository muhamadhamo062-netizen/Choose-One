import { NextResponse } from "next/server";
import { getAuthEnvIssue, pingAuthDatabase } from "@/lib/auth-db";
import { resolveAuthDatabaseUrl } from "@/lib/auth-database-url";
import { getRawSessionSecret } from "@/lib/auth-secret";

export const dynamic = "force-dynamic";

/**
 * Public auth/DB diagnostic for Vercel (no secrets). Open after deploy to see why signup fails.
 */
export async function GET() {
  const envIssue = getAuthEnvIssue();
  const sessionLen = getRawSessionSecret()?.length ?? 0;
  const authUrl = resolveAuthDatabaseUrl();
  const db = await pingAuthDatabase();

  const ready = !envIssue && db.ok;

  return NextResponse.json({
    ready,
    env: {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
      hasDirectUrl: Boolean(process.env.DIRECT_URL?.trim()),
      hasAuthDatabaseUrl: Boolean(process.env.AUTH_DATABASE_URL?.trim()),
      databaseUrlIsPooler: /pooler\.supabase\.com/i.test(process.env.DATABASE_URL ?? ""),
      authVia: authUrl?.via ?? null,
      sessionSecretChars: sessionLen,
      sessionOk: sessionLen >= 32,
      vercel: Boolean(process.env.VERCEL),
      envIssue: envIssue ?? null
    },
    database: db,
    fix:
      ready
        ? null
        : envIssue === "session_not_configured"
          ? "Vercel → Settings → Environment Variables → add SESSION_SECRET (32+ random chars) → Redeploy"
          : envIssue === "database_not_configured" || envIssue === "supabase_paste_required"
            ? "Vercel → copy DATABASE_URL (pooler :6543) and DIRECT_URL (db host :5432) from Supabase → Redeploy"
            : db.ok === false && "issue" in db && db.issue === "auth_url_missing"
              ? "Set DATABASE_URL to Supabase Transaction pooler (:6543) or AUTH_DATABASE_URL to Session pooler (:5432)"
              : "Database unreachable — Supabase not paused; DATABASE_URL must be pooler :6543; redeploy after: node scripts/sync-vercel-env.cjs"
  });
}
