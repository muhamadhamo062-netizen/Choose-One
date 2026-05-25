/**
 * Single operator-facing line for server logs when Prisma/Postgres fails (not for client responses).
 */
export function getPrismaConnectionFailureHint(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const m = raw.toLowerCase();

  if (raw.includes("P1001") || m.includes("can't reach database server")) {
    return (
      "P1001: cannot reach DB — use pooler URI copied from Supabase (Transaction, :6543, aws-0-*.pooler.supabase.com only; do not guess region), " +
      "ensure project is not paused, database password matches Settings → Database, and DIRECT_URL is the direct db.*.supabase.co:5432 string."
    );
  }
  if (m.includes("p1000") || m.includes("authentication failed") || m.includes("password authentication")) {
    return (
      "Auth failed: use the Database password from Supabase → Settings → Database (not the anon key). " +
      "If the password has @ # % etc., paste the full URI from the dashboard so it is URL-encoded."
    );
  }
  if (m.includes("econnrefused") || m.includes("connection refused")) {
    return (
      "ECONNREFUSED: host:port in DATABASE_URL is wrong or points to localhost — only use Transaction + Direct URIs from the Supabase dashboard."
    );
  }
  if (m.includes("etimedout") || m.includes("timed out")) {
    return "Timeout: Supabase project paused, network/firewall, or bad route — check dashboard project status and try again.";
  }
  if (m.includes("enotfound") || m.includes("getaddrinfo")) {
    return "DNS: a hostname in DATABASE_URL or DIRECT_URL is invalid — copy both connection strings from Supabase, do not type the pooler host.";
  }

  return `Database: ${raw.slice(0, 240)}`;
}
