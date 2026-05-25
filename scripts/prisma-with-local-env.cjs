/**
 * Load .env.local then run: npx prisma <args> with Node IPv4-first DNS (helps P1001 on some Windows envs).
 * Usage: node scripts/prisma-with-local-env.cjs db push
 */
const { spawnSync } = require("child_process");
const { loadProjectEnv, root } = require("./load-project-env.cjs");

const loaded = loadProjectEnv();
if (!loaded.ok) {
  console.error(loaded.message);
  process.exit(1);
}
const rest = process.argv.slice(2);
if (rest.length === 0) {
  console.error("Usage: node scripts/prisma-with-local-env.cjs <prisma CLI args, e.g. db push | migrate dev>");
  process.exit(1);
}
const cur = (process.env.NODE_OPTIONS || "").trim();
process.env.NODE_OPTIONS = (cur + " --dns-result-order=ipv4first").trim();

const r = spawnSync("npx", ["prisma", ...rest], { stdio: "inherit", shell: true, cwd: root, env: process.env });
process.exit(r.status === null ? 1 : r.status);
