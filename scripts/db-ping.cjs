/**
 * Verifies Prisma can connect and run SELECT 1 (same check as health route).
 * Run after: npm run db:generate:local
 *
 *   npm run db:ping
 */
const { PrismaClient } = require("@prisma/client");
const { loadProjectEnv } = require("./load-project-env.cjs");

const loaded = loadProjectEnv();
if (!loaded.ok) {
  console.error(loaded.message);
  process.exit(1);
}
console.log("Env file:", loaded.envPath);
if (!process.env.DATABASE_URL?.trim() || !process.env.DIRECT_URL?.trim()) {
  console.error(
    "DATABASE_URL and DIRECT_URL must be set. Copy only from Supabase → Project Settings → Database:\n" +
      "  • DATABASE_URL  = Connection pooling → Transaction (port 6543), full URI\n" +
      "  • DIRECT_URL    = Direct connection (port 5432), full URI\n" +
      "  Never use localhost. Append if missing:  &pgbouncer=true&connection_limit=1&sslmode=require&schema=public"
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const t0 = Date.now();
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log("OK: PostgreSQL reachable (SELECT 1) in " + (Date.now() - t0) + "ms");
    console.log("DB CONNECTED: true");
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e && e.code != null ? String((/** @type {{ code?: string }} */ (e)).code) : "";
    const msg = e instanceof Error ? e.message : String(e);
    const name = e instanceof Error ? e.name : "";
    console.error("PRISMA_RAW", code ? "code=" + code : "", name, msg);
    if (msg.includes("ECONNREFUSED") || msg.includes("connect ECONNREFUSED")) {
      console.error(
        "HINT: ECONNREFUSED — wrong host:port in DATABASE_URL (must be full Transaction URI from Supabase, not 127.0.0.1). Project paused on Supabase?"
      );
    } else if (msg.includes("P1001") || /can't reach database server/i.test(msg)) {
      console.error(
        "HINT: P1001 — paste DATABASE_URL / DIRECT_URL from Project Settings → Database only; check password; project not paused; npm run db:check"
      );
    } else if (msg.includes("Authentication failed") || msg.includes("password")) {
      console.error("HINT: database password in URI must match Supabase → Database password (paste full URI if password has @ # %).");
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
