import {
  deriveSessionPoolerUrl,
  ensureSslParam,
  parsePostgresUrl,
  poolerHostname
} from "@/lib/supabase-pg-url";

/**
 * Prisma URL for signup/login. Vercel cannot use db.*.supabase.co (IPv6).
 * Uses Session pooler (:5432) from AUTH_DATABASE_URL or derived from DATABASE_URL.
 */

export type AuthDbVia =
  | "auth_env"
  | "session_pooler"
  | "session_implicit_port"
  | "transaction_derived"
  | "direct";

export function resolveAuthDatabaseUrl():
  | { url: string; via: AuthDbVia }
  | null {
  const explicit = process.env.AUTH_DATABASE_URL?.trim();
  if (explicit) {
    return { url: ensureSslParam(explicit), via: "auth_env" };
  }

  const du = process.env.DATABASE_URL?.trim() ?? "";
  const di = process.env.DIRECT_URL?.trim() ?? "";
  const onVercel = Boolean(process.env.VERCEL);

  const session = deriveSessionPoolerUrl(du);
  if (session) {
    const u = parsePostgresUrl(du);
    const hadPort = Boolean(u?.port);
    const port = u?.port ? Number(u.port) : null;
    const via: AuthDbVia =
      port === 6543
        ? "transaction_derived"
        : port === 5432
          ? "session_pooler"
          : "session_implicit_port";
    return { url: session, via: hadPort ? via : "session_implicit_port" };
  }

  if (!onVercel && di && /db\.[^/?#]+\.supabase\.co/i.test(di)) {
    return { url: ensureSslParam(di), via: "direct" };
  }

  if (onVercel && di && poolerHostname(du)) {
    const retry = deriveSessionPoolerUrl(du);
    if (retry) {
      return { url: retry, via: "session_pooler" };
    }
  }

  return null;
}
