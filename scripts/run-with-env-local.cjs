const { spawnSync } = require("child_process");

const { loadProjectEnv, root } = require("./load-project-env.cjs");



const loaded = loadProjectEnv();

if (!loaded.ok) {
  // Prisma only auto-loads `.env`, not `.env.local`. Vercel/CI set DATABASE_URL + DIRECT_URL with no file.
  const fromPlatform =
    process.env.DATABASE_URL?.trim() && process.env.DIRECT_URL?.trim();
  if (!fromPlatform) {
    console.error(loaded.message);
    process.exit(1);
  }
}

// Prefer IPv4 on Windows; helps Prisma reach Supabase when IPv6 to db.*.supabase.co fails.
const _no = (process.env.NODE_OPTIONS || "").trim();
process.env.NODE_OPTIONS = (_no + " --dns-result-order=ipv4first").trim();

const [cmd, ...args] = process.argv.slice(2);

if (!cmd) {

  console.error("Usage: node scripts/run-with-env-local.cjs <command> [args...]");

  process.exit(1);

}

const r = spawnSync(cmd, args, {

  stdio: "inherit",

  shell: process.platform === "win32",

  cwd: root,

  env: process.env

});

process.exit(r.status === null ? 1 : r.status);

