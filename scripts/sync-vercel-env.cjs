/* eslint-disable no-console */
/**
 * Push DB + auth env to Vercel Production (fixes signup "no database" on Vercel).
 *
 *   node scripts/sync-vercel-env.cjs
 *   npx vercel --prod --yes
 */
const { readFileSync, existsSync } = require("fs");
const { resolve } = require("path");
const { execSync } = require("child_process");

const root = resolve(__dirname, "..");

function parsePostgresUrl(raw) {
  try {
    return new URL(raw.trim().replace(/^postgresql:/i, "postgres:"));
  } catch {
    return null;
  }
}

function serializePostgresUrl(u) {
  return u.toString().replace(/^postgres:/i, "postgresql:");
}

function ensurePoolerPort(raw, port) {
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

function stripPgbouncer(url) {
  return url
    .replace(/([?&])pgbouncer=true(&)?/gi, (_, lead, amp) => (amp ? lead : ""))
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");
}

function deriveSessionPoolerUrl(databaseUrl) {
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
    u.searchParams.delete("pgbouncer");
    return serializePostgresUrl(u);
  }
  const tx = port === null || port === 6543 ? ensurePoolerPort(raw, 6543) : raw;
  const su = parsePostgresUrl(tx);
  if (!su) {
    return null;
  }
  su.port = "5432";
  su.searchParams.delete("pgbouncer");
  let out = serializePostgresUrl(su);
  if (!/sslmode=require/i.test(out)) {
    out += (out.includes("?") ? "&" : "?") + "sslmode=require";
  }
  return out;
}

function normalizeDatabaseUrl(raw) {
  if (!raw || !/pooler\.supabase\.com/i.test(raw)) {
    return raw;
  }
  let url = ensurePoolerPort(raw.trim(), 6543);
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

function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) {
    return out;
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      continue;
    }
    const eq = t.indexOf("=");
    if (eq < 1) {
      continue;
    }
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function pushEnv(key, value) {
  try {
    execSync(`npx vercel env rm ${key} production --yes`, { cwd: root, stdio: "pipe" });
  } catch {
    // unset
  }
  execSync(`npx vercel env add ${key} production --force`, {
    cwd: root,
    input: value,
    stdio: ["pipe", "inherit", "inherit"]
  });
  console.log(`[ok] ${key} → Vercel Production`);
}

const merged = {
  ...parseEnvFile(resolve(root, ".env")),
  ...parseEnvFile(resolve(root, ".env.local"))
};

let databaseUrl = merged.DATABASE_URL?.trim();
const directUrl = merged.DIRECT_URL?.trim();

if (!databaseUrl || !directUrl) {
  console.error("[fail] DATABASE_URL and DIRECT_URL required in .env");
  process.exit(1);
}

if (!/pooler\.supabase\.com/i.test(databaseUrl)) {
  console.error(
    "[fail] DATABASE_URL must use *.pooler.supabase.com (Transaction from Supabase).\n" +
      "       You may have pasted the Direct URL into DATABASE_URL by mistake."
  );
  process.exit(1);
}

databaseUrl = normalizeDatabaseUrl(databaseUrl);
const authDatabaseUrl = deriveSessionPoolerUrl(databaseUrl);

if (!authDatabaseUrl) {
  console.error("[fail] Could not derive AUTH_DATABASE_URL from DATABASE_URL");
  process.exit(1);
}

const toPush = {
  DATABASE_URL: databaseUrl,
  DIRECT_URL: directUrl,
  AUTH_DATABASE_URL: authDatabaseUrl,
  SESSION_SECRET: merged.SESSION_SECRET?.trim(),
  LEMON_SQUEEZY_WEBHOOK_SECRET: merged.LEMON_SQUEEZY_WEBHOOK_SECRET?.trim(),
  NEXT_PUBLIC_LEMON_SQUEEZY_CHECKOUT_URL: merged.NEXT_PUBLIC_LEMON_SQUEEZY_CHECKOUT_URL?.trim(),
  NEXT_PUBLIC_LEMON_SQUEEZY_STORE_SLUG: merged.NEXT_PUBLIC_LEMON_SQUEEZY_STORE_SLUG?.trim(),
  NEXT_PUBLIC_LEMON_SQUEEZY_VARIANT_ID: merged.NEXT_PUBLIC_LEMON_SQUEEZY_VARIANT_ID?.trim(),
  NEXT_PUBLIC_SUPABASE_URL: merged.NEXT_PUBLIC_SUPABASE_URL?.trim(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: merged.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
};

if (!toPush.SESSION_SECRET || toPush.SESSION_SECRET.length < 32) {
  console.error("[fail] SESSION_SECRET missing or <32 chars. Run: node scripts/set-session-secret.cjs");
  process.exit(1);
}

console.log("[info] DATABASE_URL pooler port:", parsePostgresUrl(databaseUrl)?.port || "(set)");
console.log("[info] AUTH_DATABASE_URL pooler port:", parsePostgresUrl(authDatabaseUrl)?.port || "(set)");

for (const [key, value] of Object.entries(toPush)) {
  if (!value) {
    console.warn(`[skip] ${key} missing`);
    continue;
  }
  pushEnv(key, value);
}

console.log("\nDone. Redeploy: npx vercel --prod --yes");
console.log("Then open: /api/health/auth — expect ready: true, authVia: auth_env or session_*");
