/* eslint-disable no-console */
const { readFileSync, writeFileSync, existsSync } = require("fs");
const { resolve } = require("path");
const { spawnSync } = require("child_process");
const { loadProjectEnv, root } = require("./load-project-env.cjs");

function parseEnvFile(path) {
  const map = {};
  if (!existsSync(path)) return map;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    map[k] = v;
  }
  return map;
}

function replaceEnvVarContent(content, key, value) {
  const line = `${key}="${value}"`;
  const rx = new RegExp(`^${key}=.*$`, "m");
  if (rx.test(content)) {
    return content.replace(rx, line);
  }
  return `${content.trimEnd()}\n${line}\n`;
}

function setEnvVarInFile(path, key, value) {
  const content = existsSync(path) ? readFileSync(path, "utf8") : "";
  const next = replaceEnvVarContent(content, key, value);
  writeFileSync(path, next, "utf8");
}

function run(command, args, extraEnv = {}) {
  return spawnSync(command, args, {
    cwd: root,
    shell: process.platform === "win32",
    stdio: "inherit",
    env: { ...process.env, ...extraEnv }
  });
}

function buildCandidateDatabaseUrls(baseUrl, projectRef) {
  const out = [];
  let u;
  try {
    u = new URL(baseUrl);
  } catch {
    return out;
  }
  if (!/pooler\.supabase\.com$/i.test(u.hostname)) {
    return [baseUrl];
  }

  const q = u.search || "?pgbouncer=true&connection_limit=1&sslmode=require&schema=public";
  const pass = decodeURIComponent(u.password || "");
  const host = u.hostname;
  const path = u.pathname || "/postgres";
  const proto = u.protocol || "postgresql:";

  if (projectRef) {
    out.push(`${proto}//postgres.${projectRef}:${pass}@${host}${path}${q}`);
  }
  out.push(`${proto}//postgres:${pass}@${host}${path}${q}`);
  if (projectRef) {
    out.push(`${proto}//postgres.${projectRef}:${pass}@${host}${path}?pgbouncer=true&connection_limit=1&sslmode=require`);
  }
  return Array.from(new Set(out));
}

function main() {
  const loaded = loadProjectEnv();
  if (!loaded.ok) {
    console.error(loaded.message);
    process.exit(1);
  }

  const envLocalPath = resolve(root, ".env.local");
  const envPath = resolve(root, ".env");
  const envLocal = parseEnvFile(envLocalPath);
  const envFile = parseEnvFile(envPath);
  const rawDatabaseUrl = envLocal.DATABASE_URL || envFile.DATABASE_URL || process.env.DATABASE_URL;
  const directUrl = envLocal.DIRECT_URL || envFile.DIRECT_URL || process.env.DIRECT_URL || "";
  const publicUrl = envLocal.NEXT_PUBLIC_SUPABASE_URL || envFile.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  if (!rawDatabaseUrl) {
    console.error("Missing DATABASE_URL in .env/.env.local");
    process.exit(1);
  }

  let projectRef = null;
  try {
    if (publicUrl) {
      projectRef = new URL(publicUrl).hostname.split(".")[0] || null;
    }
  } catch {
    projectRef = null;
  }

  const candidates = buildCandidateDatabaseUrls(rawDatabaseUrl, projectRef);
  if (candidates.length === 0) {
    console.error("DATABASE_URL format is invalid.");
    process.exit(1);
  }

  console.log(`[db-force-sync] trying ${candidates.length} candidate DATABASE_URL variants...`);

  const gen = run("npx", ["prisma", "generate"]);
  if (gen.status !== 0) {
    process.exit(gen.status || 1);
  }

  for (const candidate of candidates) {
    console.log("[db-force-sync] trying candidate:", candidate.replace(/:(?:[^:@/]{3,})@/, ":***@"));
    const pushed = run("npx", ["prisma", "db", "push", "--accept-data-loss"], {
      DATABASE_URL: candidate,
      ...(directUrl ? { DIRECT_URL: directUrl } : {})
    });
    if (pushed.status === 0) {
      console.log("[db-force-sync] success. syncing .env and .env.local DATABASE_URL");
      setEnvVarInFile(envPath, "DATABASE_URL", candidate);
      setEnvVarInFile(envLocalPath, "DATABASE_URL", candidate);
      process.exit(0);
    }
  }

  console.error("[db-force-sync] all candidate auth attempts failed (P1000). Reset Supabase DB password then retry.");
  process.exit(1);
}

main();
