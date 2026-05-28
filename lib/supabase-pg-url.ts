/** Parse/normalize Supabase Postgres URIs (no secrets logged). */

export function parsePostgresUrl(raw: string): URL | null {
  const s = raw.trim();
  if (!s) {
    return null;
  }
  try {
    return new URL(s.replace(/^postgresql:/i, "postgres:"));
  } catch {
    return null;
  }
}

export function serializePostgresUrl(u: URL): string {
  return u.toString().replace(/^postgres:/i, "postgresql:");
}

export function poolerHostname(url: string): string | null {
  const u = parsePostgresUrl(url);
  if (!u || !/\.pooler\.supabase\.com$/i.test(u.hostname)) {
    return null;
  }
  return u.hostname;
}

/** Supabase pooler URIs often omit `:6543` — Prisma then fails or picks the wrong mode. */
export function ensurePoolerPort(raw: string, port: 5432 | 6543): string {
  const u = parsePostgresUrl(raw);
  if (!u || !/\.pooler\.supabase\.com$/i.test(u.hostname)) {
    return raw;
  }
  if (!u.port) {
    u.port = String(port);
    return serializePostgresUrl(u);
  }
  return raw;
}

export function stripPgbouncerParams(url: string): string {
  let u = url.replace(/([?&])pgbouncer=true(&)?/gi, (_, lead, amp) => (amp ? lead : ""));
  u = u.replace(/\?&/, "?").replace(/&&+/g, "&").replace(/[?&]$/, "");
  return u;
}

export function ensureSslParam(url: string): string {
  if (/sslmode=require/i.test(url)) {
    return url;
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}sslmode=require`;
}

/** Transaction (:6543) → Session (:5432) on the same pooler host. */
export function transactionPoolerToSessionUrl(url: string): string {
  let u = parsePostgresUrl(url);
  if (!u) {
    return ensureSslParam(stripPgbouncerParams(url.replace(/:6543(?=[/?#]|$)/, ":5432")));
  }
  u.port = "5432";
  u.searchParams.delete("pgbouncer");
  return ensureSslParam(serializePostgresUrl(u));
}

/**
 * Session pooler URL for signup/login (Vercel-safe).
 * Handles pooler host with missing port, :6543, or :5432.
 */
export function deriveSessionPoolerUrl(databaseUrl: string): string | null {
  const raw = databaseUrl.trim();
  if (!/\.pooler\.supabase\.com/i.test(raw)) {
    return null;
  }

  const u = parsePostgresUrl(raw);
  if (!u) {
    return null;
  }

  const port = u.port ? Number(u.port) : null;
  if (port === 5432) {
    return ensureSslParam(stripPgbouncerParams(serializePostgresUrl(u)));
  }

  if (port === 6543 || port === null) {
    const tx = port === null ? ensurePoolerPort(raw, 6543) : raw;
    return transactionPoolerToSessionUrl(tx);
  }

  u.port = "5432";
  return ensureSslParam(stripPgbouncerParams(serializePostgresUrl(u)));
}

/** Transaction pooler for general Prisma (`DATABASE_URL`). */
export function deriveTransactionPoolerUrl(databaseUrl: string): string {
  let url = databaseUrl.trim();
  if (!/\.pooler\.supabase\.com/i.test(url)) {
    return url;
  }
  url = ensurePoolerPort(url, 6543);
  const sep = url.includes("?") ? "&" : "?";
  if (!/pgbouncer=true/i.test(url)) {
    url += `${sep}pgbouncer=true`;
  }
  if (!/connection_limit=1/i.test(url)) {
    url += "&connection_limit=1";
  }
  if (!/sslmode=require/i.test(url)) {
    url += "&sslmode=require";
  }
  if (!/schema=public|schema%3Dpublic/i.test(url)) {
    url += "&schema=public";
  }
  return url;
}
