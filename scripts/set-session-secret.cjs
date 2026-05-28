/* eslint-disable no-console */
/**
 * Sync SESSION_SECRET from .env.local to Vercel Production (requires `vercel login`).
 * Usage: node scripts/set-session-secret.cjs
 */
const { execSync } = require("child_process");
const { readFileSync, existsSync } = require("fs");
const { resolve } = require("path");

const root = resolve(__dirname, "..");
const envPath = existsSync(resolve(root, ".env.local"))
  ? resolve(root, ".env.local")
  : resolve(root, ".env");

const text = readFileSync(envPath, "utf8");
const m = text.match(/^SESSION_SECRET=(.+)$/m);
if (!m) {
  console.error("SESSION_SECRET not found in", envPath);
  process.exit(1);
}
let secret = m[1].trim();
if (
  (secret.startsWith('"') && secret.endsWith('"')) ||
  (secret.startsWith("'") && secret.endsWith("'"))
) {
  secret = secret.slice(1, -1);
}
if (secret.length < 32) {
  console.error("SESSION_SECRET must be at least 32 characters, got", secret.length);
  process.exit(1);
}

try {
  execSync("npx vercel env rm SESSION_SECRET production --yes", { cwd: root, stdio: "pipe" });
} catch {
  // unset
}

execSync("npx vercel env add SESSION_SECRET production --force", {
  cwd: root,
  input: secret,
  stdio: ["pipe", "inherit", "inherit"]
});

console.log("OK: Vercel Production SESSION_SECRET updated. Redeploy: vercel --prod --yes");
