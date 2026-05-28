/* eslint-disable no-console */
/**
 * Push required env vars from .env / .env.local to Vercel Production (one-time fix for "service busy").
 * Requires: vercel login + linked project.
 *
 *   node scripts/sync-vercel-env.cjs
 *   npx vercel --prod --yes
 */
const { readFileSync, existsSync } = require("fs");
const { resolve } = require("path");
const { execSync } = require("child_process");

const root = resolve(__dirname, "..");
const KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SESSION_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
];

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

const merged = {
  ...parseEnvFile(resolve(root, ".env")),
  ...parseEnvFile(resolve(root, ".env.local"))
};

for (const key of KEYS) {
  const value = merged[key]?.trim();
  if (!value) {
    console.warn(`[skip] ${key} missing in .env / .env.local`);
    continue;
  }
  if (key === "SESSION_SECRET" && value.length < 32) {
    console.error(`[fail] ${key} must be 32+ chars (got ${value.length}). Run: node scripts/set-session-secret.cjs`);
    process.exit(1);
  }
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

console.log("\nDone. Redeploy: npx vercel --prod --yes");
console.log("Then open: /api/health/auth — expect ready: true");
