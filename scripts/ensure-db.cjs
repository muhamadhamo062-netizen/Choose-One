/**
 * Ensures the database named in DATABASE_URL exists.
 * If connection fails with "database does not exist" (P1003), connects to
 * the built-in "postgres" database and runs CREATE DATABASE.
 *
 * Windows: requires PostgreSQL service running; URL must be correct.
 * Does NOT start the service (cannot from Node).
 */
const { PrismaClient } = require("@prisma/client");
const { loadProjectEnv } = require("./load-project-env.cjs");

const loaded = loadProjectEnv();
if (!loaded.ok) {
  console.error(loaded.message);
  process.exit(1);
}
const mainUrl = process.env.DATABASE_URL?.trim();
if (!mainUrl) {
  console.error("DATABASE_URL is empty");
  process.exit(1);
}

/** Path segment after host:port/ before ? is the database name. */
function databaseNameFromUrl(url) {
  try {
    const u = new URL(url);
    const seg = (u.pathname || "/").replace(/^\//, "").split("/")[0];
    if (seg) return seg;
  } catch {
    // ignore
  }
  const m = url.match(/\/([^/?]+)(\?|#|$)/);
  return m && m[1] ? m[1] : "privacyeraser";
}

/** Connect to the default "postgres" database (maintenance) with same user/host/port. */
function toPostgresAdminUrl(url) {
  return url.replace(/\/([^/?]+)(\?|#|$)/, "/postgres$2");
}

function isSafeDbName(name) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

async function trySelect1(url) {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, prisma };
  } catch (e) {
    await prisma.$disconnect().catch(() => {});
    return { ok: false, error: e };
  }
}

async function main() {
  const targetDb = databaseNameFromUrl(mainUrl);
  if (!isSafeDbName(targetDb)) {
    console.error("Refusing: database name in DATABASE_URL must be alphanumeric/underscore for auto-create");
    process.exit(1);
  }

  let r = await trySelect1(mainUrl);
  if (r.ok) {
    await r.prisma.$disconnect();
    console.log("DB CONNECTED: true");
    return;
  }

  const em = r.error instanceof Error ? r.error.message : String(r.error);
  const code = r.error && r.error.code ? String(r.error.code) : "";

  const mightBeMissingDb =
    code === "P1003" ||
    /P1003/i.test(em) ||
    /database .*does not exist/i.test(em) ||
    /3D000/i.test(em);

  if (em.includes("ECONNREFUSED") || (em.includes("P1001") && !mightBeMissingDb)) {
    console.error("FAIL: cannot connect to server:\n", em);
    console.error(
      "→ Windows: open services.msc, start the PostgreSQL service, or set DATABASE_URL to the correct host, port, user, and password."
    );
    if (em.includes("ECONNREFUSED")) {
      console.error("→ ECONNREFUSED: nothing listening on the host:port in DATABASE_URL (wrong port or service stopped).");
    }
    process.exit(1);
  }

  if (!mightBeMissingDb) {
    console.error("FAIL:", em);
    if (/password|authentication|28P01/i.test(em)) {
      console.error("→ Check POSTGRES user/password in DATABASE_URL (Windows: user you set on install, often 'postgres').");
    }
    process.exit(1);
  }

  console.log(`Database "${targetDb}" missing; creating via maintenance connection to "postgres"…`);
  const adminUrl = toPostgresAdminUrl(mainUrl);
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  try {
    await admin.$connect();
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("FAIL: could not connect to maintenance database \"postgres\":", m);
    console.error("→ Fix credentials in DATABASE_URL, or create the database manually in pgAdmin: CREATE DATABASE " + targetDb + ";");
    process.exit(1);
  }

  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${targetDb}"`);
    console.log(`Created database "${targetDb}".`);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (/already exists/i.test(m) || /42P04/.test(m)) {
      console.log("Database already exists (race or pre-created).");
    } else {
      await admin.$disconnect();
      console.error("CREATE DATABASE failed:", m);
      process.exit(1);
    }
  }
  await admin.$disconnect();

  r = await trySelect1(mainUrl);
  if (!r.ok) {
    const m = r.error instanceof Error ? r.error.message : String(r.error);
    console.error("FAIL: after CREATE DATABASE, still cannot connect:\n", m);
    process.exit(1);
  }
  await r.prisma.$disconnect();
  console.log("DB CONNECTED: true");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
