/**
 * POST a sandbox-shaped transaction.completed to /api/webhooks/paddle
 * with a valid Paddle-Signature. Requires: dev server, DATABASE, env from .env.local
 *
 * Usage: node scripts/run-with-env-local.cjs node scripts/paddle-webhook-e2e.cjs
 * Or:    node scripts/paddle-webhook-e2e.cjs (if env already in process)
 */
const { createHmac } = require("crypto");

const secret = process.env.PADDLE_WEBHOOK_SECRET?.trim();
if (!secret) {
  console.error("PADDLE_WEBHOOK_SECRET is required");
  process.exit(1);
}

const eventId = `evt_e2e_${Date.now()}`;
const transactionId = `txn_e2e_${Date.now()}`;

const payload = {
  event_id: eventId,
  event_type: "transaction.completed",
  data: {
    id: transactionId,
    customer: { email: "e2e-webhook@example.com" },
    custom_data: { public_scan_id: "scan-e2e-optional" }
  }
};

const rawBody = JSON.stringify(payload);
const ts = String(Math.floor(Date.now() / 1000));
const signedPayload = `${ts}:${rawBody}`;
const h1 = createHmac("sha256", secret).update(signedPayload).digest("hex");
const sig = `ts=${ts};h1=${h1}`;

const url = process.env.WEBHOOK_TEST_URL || "http://127.0.0.1:3000/api/webhooks/paddle";

async function postOnce(label) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Paddle-Signature": sig
    },
    body: rawBody
  });
  const text = await res.text();
  console.log(`\n${label}: ${res.status} ${res.statusText}`);
  console.log(text.slice(0, 2000));
  return { status: res.status, text, transactionId, eventId };
}

(async () => {
  console.log("URL:", url);
  const a = await postOnce("First POST (fulfill)");
  if (a.status >= 400) {
    process.exit(1);
  }
  const b = await postOnce("Second POST (idempotency / dedupe)");
  if (b.status === 200 && b.text.includes("deduped")) {
    console.log("\nIdempotency: same event_id short-circuited (expected on replay).");
  }
  console.log("\nTo verify session, run (replace txn id if needed):");
  console.log(
    `  curl -s -D - -X POST http://127.0.0.1:3000/api/user/session-from-transaction -H "Content-Type: application/json" -d "{\\"transactionId\\":\\"${transactionId}\\"}" -c _cookies.txt`
  );
  console.log("Then check for Set-Cookie: pe_session=...");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
