/**
 * Enforces Supabase + Prisma env rules (no local Docker/127.0.0.1 for DATABASE/DIRECT).
 * Used at dev/build time and by /api/health/integrations.
 */
const PLACEHOLDER =
  /YOUR_[A-Z0-9_]+|PASTE_[A-Z0-9_]+|REPLACE_ME|__REPLACE__|CHANGEME|SET_ME|INVALID[-_]PLEASE/i;
const PLACEHOLDER_HOST = /MUST_PASTE|POOLER_HOST|PASTE_POOLER|__COPY_/i;

/** True if URLs look like a template; does not block dev — connection will fail until replaced. */
export function hasSupabaseEnvPlaceholderTokens(du: string, di: string): boolean {
  return (
    PLACEHOLDER.test(du) ||
    PLACEHOLDER_HOST.test(du) ||
    PLACEHOLDER.test(di) ||
    PLACEHOLDER_HOST.test(di)
  );
}

/** Unfinished .env: placeholder password/region, or "REPLACE" / FROM_DASHBOARD in host — not real Supabase copy-paste. */
export function isSupabaseEnvUnfinishedTemplate(du: string, di: string): boolean {
  const s = (du + "\n" + di).toLowerCase();
  if (hasSupabaseEnvPlaceholderTokens(du, di)) {
    return true;
  }
  if (/replace_with|from_dashboard|your_database_password|paste_transaction|paste_direct|example\.com\/|\.invalid/i.test(s)) {
    return true;
  }
  if (/aws-0-[^/]*replace[^/]*\.pooler|aws-0-[^/]*your[^/]*\.pooler/i.test(du + di)) {
    return true;
  }
  return false;
}

export function getSupabasePrismaEnvErrors(): string[] {
  const out: string[] = [];
  const du = process.env.DATABASE_URL?.trim() ?? "";
  const di = process.env.DIRECT_URL?.trim() ?? "";

  if (!du) {
    out.push("DATABASE_URL is empty — set Transaction pooler (6543) from Supabase → Settings → Database");
  }
  if (!di) {
    out.push("DIRECT_URL is empty — set Direct connection (db.*.supabase.co:5432) for Prisma migrate/db push");
  }
  if (!du || !di) {
    return out;
  }

  if (isSupabaseEnvUnfinishedTemplate(du, di)) {
    out.push(
      "DATABASE_URL and DIRECT_URL must be the full connection strings from Supabase → Settings → Database (Connection pooling = Transaction, then Direct) — not password/region placeholders"
    );
    return out;
  }

  if (/127\.0\.0\.1|localhost/i.test(du)) {
    out.push("DATABASE_URL must not use 127.0.0.1/localhost — use Supabase Transaction pooler on port 6543");
  }
  if (/127\.0\.0\.1|localhost/i.test(di)) {
    out.push("DIRECT_URL must not use 127.0.0.1/localhost — use Supabase Direct (db.*.supabase.co:5432)");
  }

  const dbUrlIsPooler = /pooler\.supabase\.com/i.test(du);
  const dbUrlIsDirectHost = /db\.[^/?#]+\.supabase\.co/i.test(du);
  if (!dbUrlIsPooler && !dbUrlIsDirectHost) {
    out.push(
      "DATABASE_URL must use either *.pooler.supabase.com (preferred Transaction URL) or db.<project-ref>.supabase.co (direct fallback)"
    );
  }
  if (dbUrlIsPooler && !/:6543[/?#]/.test(du) && !/:6543"/.test(du)) {
    out.push("DATABASE_URL pooler mode must use port 6543 (Supabase connection pooling → Transaction mode)");
  }
  if (dbUrlIsDirectHost && !/:5432[/?#]/.test(du) && !/:5432"/.test(du)) {
    out.push("DATABASE_URL direct fallback must use port 5432");
  }
  if (/pooler\.supabase\.com/i.test(di)) {
    out.push("DIRECT_URL must be the direct connection, not the pooler");
  }
  if (!/db\.[^/?#]+\.supabase\.co/i.test(di)) {
    out.push("DIRECT_URL should use host db.<project-ref>.supabase.co (Supabase direct connection string)");
  }
  if (!/:5432[/?#]/.test(di) && !/:5432"/.test(di)) {
    out.push("DIRECT_URL must use port 5432 (Supabase direct connection)");
  }

  if (du) {
    if (dbUrlIsPooler && !du.includes("pgbouncer=true")) {
      out.push("DATABASE_URL must include pgbouncer=true (append if missing)");
    }
    if (dbUrlIsPooler && !/connection_limit=1/i.test(du)) {
      out.push("DATABASE_URL must include connection_limit=1 (PgBouncer + Prisma)");
    }
    if (!/sslmode=require/i.test(du)) {
      out.push("DATABASE_URL must include sslmode=require");
    }
    if (!/schema=public|schema%3Dpublic/i.test(du)) {
      out.push("DATABASE_URL must include schema=public (this Prisma project uses the public schema)");
    }
  }

  if (di && !/sslmode=require/i.test(di)) {
    out.push("DIRECT_URL should include sslmode=require");
  }

  return out;
}
