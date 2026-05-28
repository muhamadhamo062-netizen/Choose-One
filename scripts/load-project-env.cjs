const { readFileSync, existsSync } = require("fs");
const { resolve } = require("path");

const root = resolve(__dirname, "..");

function deriveSupabaseProjectRef() {
  const fromPublic = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (fromPublic) {
    try {
      const host = new URL(fromPublic).hostname;
      const ref = host.split(".")[0];
      if (ref) return ref;
    } catch {
      // ignore parse errors
    }
  }

  const direct = (process.env.DIRECT_URL || "").trim();
  if (direct) {
    try {
      const host = new URL(direct).hostname;
      // db.<ref>.supabase.co
      const parts = host.split(".");
      if (parts.length >= 3 && parts[0] === "db" && parts[1]) {
        return parts[1];
      }
    } catch {
      // ignore parse errors
    }
  }
  return null;
}

function autoHealDatabaseUrl() {
  const raw = (process.env.DATABASE_URL || "").trim();
  if (!raw) return;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return;
  }

  const isPooler = /pooler\.supabase\.com$/i.test(u.hostname);
  if (!isPooler) return;

  if (!u.port) {
    u.port = "6543";
    process.env.DATABASE_URL = u.toString().replace(/^postgres:/, "postgresql:");
    // eslint-disable-next-line no-console
    console.warn("[env:auto-heal] DATABASE_URL missing port — set to 6543 (Transaction pooler).");
  }

  // Common Supabase pooler failure: username is plain "postgres" instead of "postgres.<project_ref>"
  if (u.username === "postgres") {
    const ref = deriveSupabaseProjectRef();
    if (ref) {
      u.username = `postgres.${ref}`;
      process.env.DATABASE_URL = u.toString();
      // eslint-disable-next-line no-console
      console.warn("[env:auto-heal] DATABASE_URL username adjusted to pooler format.");
    }
  }
}

/**
 * Loads `.env.local` (preferred) or `.env` into `process.env`.
 * @returns {{ ok: true, envPath: string, root: string } | { ok: false, message: string, root: string }}
 */
function loadProjectEnv() {
  const envLocal = resolve(root, ".env.local");
  const envFile = resolve(root, ".env");
  const envPath = existsSync(envLocal) ? envLocal : envFile;
  if (!existsSync(envPath)) {
    return { ok: false, root, message: "Missing .env.local or .env (copy from .env.example)" };
  }
  const text = readFileSync(envPath, "utf8");
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
    process.env[k] = v;
  }
  autoHealDatabaseUrl();
  return { ok: true, root, envPath };
}

module.exports = { loadProjectEnv, root };
