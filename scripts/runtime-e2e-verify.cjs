/**
 * Full local runtime check: load .env.local → Prisma → optional HTTP (health, webhook, session).
 * Writes _runtime_e2e.log in project root. Node 18+.
 *
 * Usage:
 *   node scripts/runtime-e2e-verify.cjs
 *   node scripts/runtime-e2e-verify.cjs --http   # requires dev server on :3000
 */
const { writeFileSync, appendFileSync } = require("fs");
const { resolve } = require("path");
const { execSync } = require("child_process");
const { createHmac } = require("crypto");
const { loadProjectEnv, root: projectRoot } = require("./load-project-env.cjs");

const root = projectRoot;
const logFile = resolve(root, "_runtime_e2e.log");
function log(line) {
  const s = typeof line === "string" ? line : JSON.stringify(line, null, 2);
  appendFileSync(logFile, s + "\n", "utf8");
  console.log(s);
}
writeFileSync(logFile, `=== ${new Date().toISOString()} ===\n`, "utf8");

const loaded = loadProjectEnv();
if (!loaded.ok) {
  log("FAIL: " + loaded.message);
  process.exit(1);
}
log("Using env file: " + loaded.envPath);

if (!process.env.DATABASE_URL?.trim()) {
  log("FAIL: DATABASE_URL not set in .env.local");
  process.exit(1);
}

const env = { ...process.env };

function run(name, cmd) {
  log(`\n-- ${name} --`);
  try {
    const out = execSync(cmd, { cwd: root, env, shell: true, encoding: "utf8", maxBuffer: 5 * 1024 * 1024 });
    log(out || "(no stdout)");
  } catch (e) {
    log(String(e.stdout || ""));
    log(String(e.stderr || ""));
    log(`FAIL: ${name} exit ${e.status}`);
    process.exit(1);
  }
}

run("npx prisma generate", "npx prisma generate");
run("npx prisma db push", "npx prisma db push");

const doHttp = process.argv.includes("--http");
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";

async function httpPhase() {
  log("\n-- GET /api/health/integrations --");
  let h;
  try {
    h = await fetch(`${base}/api/health/integrations`, { cache: "no-store" });
  } catch (e) {
    log("FAIL: " + (e && e.message));
    return;
  }
  const body = await h.text();
  log("status: " + h.status);
  log(body);
  let j;
  try {
    j = JSON.parse(body);
  } catch {
    log("FAIL: not JSON");
    return;
  }
  if (j.database && j.database.connected === true) {
    log("OK: database.connected === true");
  } else {
    log("FAIL: database.connected is not true: " + JSON.stringify(j.database));
  }

  const secret = process.env.PADDLE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    log("FAIL: PADDLE_WEBHOOK_SECRET");
    return;
  }

  const eventId = `evt_e2e_${Date.now()}`;
  const transactionId = `txn_e2e_${Date.now()}`;
  const payload = {
    event_id: eventId,
    event_type: "transaction.completed",
    data: {
      id: transactionId,
      customer: { email: "e2e-verify@example.com" },
      custom_data: {}
    }
  };
  const rawBody = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const h1 = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");
  const sig = `ts=${ts};h1=${h1}`;

  log("\n-- POST /api/webhooks/paddle (first) --");
  const w1 = await fetch(`${base}/api/webhooks/paddle`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Paddle-Signature": sig },
    body: rawBody
  });
  const w1b = await w1.text();
  log("status: " + w1.status);
  log(w1b);

  log("\n-- POST /api/webhooks/paddle (idempotency) --");
  const w2 = await fetch(`${base}/api/webhooks/paddle`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Paddle-Signature": sig },
    body: rawBody
  });
  const w2b = await w2.text();
  log("status: " + w2.status);
  log(w2b);
  if (w2b.includes("deduped") || w2b.includes("dedup")) {
    log("OK: idempotency (deduped) response");
  }

  log("\n-- POST /api/user/session-from-transaction --");
  const s1 = await fetch(`${base}/api/user/session-from-transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactionId })
  });
  const s1h = s1.headers.get("set-cookie") || "";
  const s1b = await s1.text();
  log("status: " + s1.status);
  log(s1b);
  if (s1h.toLowerCase().includes("pe_session")) {
    log("OK: Set-Cookie contains pe_session");
  } else {
    log("WARN: no pe_session in Set-Cookie: " + s1h.slice(0, 200));
  }
  if (s1.status === 200) {
    log("OK: session-from-transaction 200");
  }
}

(async () => {
  if (doHttp) {
    await httpPhase();
  } else {
    log("\n(Skip HTTP: run with --http after `npm run dev:local` is up)");
  }
  log("\nDONE");
})().catch((e) => {
  log(String(e && e.message));
  process.exit(1);
});
