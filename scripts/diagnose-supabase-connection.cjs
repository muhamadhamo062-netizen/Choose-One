/**
 * Network + hostname checks for Supabase + Prisma (P1001 debugging).
 * Run: npm run db:diagnose
 */
const dns = require("dns");
const net = require("net");
const { promisify } = require("util");
const { loadProjectEnv } = require("./load-project-env.cjs");

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);

function parsePgUrl(name, raw) {
  if (!raw || typeof raw !== "string") {
    return { name, err: "missing" };
  }
  try {
    const u = new URL(raw);
    return {
      name,
      host: u.hostname,
      port: parseInt(u.port || (u.protocol === "postgresql:" ? "5432" : "5432"), 10),
      hasSsl: u.searchParams.get("sslmode") === "require" || u.search.toLowerCase().includes("sslmode")
    };
  } catch (e) {
    return { name, err: String(e) };
  }
}

/** Supabase pooler hosts should look like aws-0-eu-north-1.pooler (region with hyphens), not a 20-char project ref. */
function poolerHostHeuristic(host) {
  if (!host || !host.includes("pooler.supabase.com")) {
    return null;
  }
  const m = host.match(/aws-(\d+)-([^.]+)\.pooler\.supabase\.com/);
  if (!m) {
    return null;
  }
  const mid = m[2];
  const likeProjectRef = /^[a-z0-9]{18,24}$/i.test(mid) && !mid.includes("-");
  if (likeProjectRef) {
    return `The segment "${mid}" in ${host} looks like a project ref, not an AWS region. Pooler hostnames are usually like aws-0-eu-north-1.pooler.supabase.com. Copy the full URI from: Supabase → Project Settings → Database → Connection string → "Transaction pooler" / Connection pooling.`;
  }
  return null;
}

function tcpProbe(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let finished = false;
    const done = (result) => {
      if (finished) {
        return;
      }
      finished = true;
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      clearTimeout(t);
      resolve(result);
    };
    const t = setTimeout(() => done({ ok: false, reason: "timeout" }), timeoutMs);
    socket.once("connect", () => done({ ok: true }));
    socket.once("error", (err) => done({ ok: false, reason: err.code || err.message }));
  });
}

async function main() {
  const loaded = loadProjectEnv();
  if (!loaded.ok) {
    console.error(loaded.message);
    process.exit(1);
  }
  console.log("Env:", loaded.envPath, "\n");

  if (!process.env.DATABASE_URL?.trim()) {
    console.log("NOTE: DATABASE_URL is empty. Paste the *full* Transaction pooler URI (Supabase → Database → Connection pooling), then re-run this script.\n");
  }

  const p1 = parsePgUrl("DATABASE_URL (pooler, runtime)", process.env.DATABASE_URL);
  const p2 = parsePgUrl("DIRECT_URL (migrations / db push)", process.env.DIRECT_URL);

  for (const p of [p1, p2]) {
    if (p.err) {
      console.log(`[${p.name}] ERROR:`, p.err);
      continue;
    }
    const warn = poolerHostHeuristic(p.host);
    console.log(`[${p.name}]`);
    console.log("  host:", p.host, "  port:", p.port, "  ssl in query: ok for production");
    if (warn) {
      console.log("  ** WARNING **");
      console.log("  ", warn);
    }
    try {
      const a4 = await resolve4(p.host);
      console.log("  DNS A (IPv4):", a4[0]);
    } catch (e) {
      console.log("  DNS A (IPv4): FAIL", e.code || e.message);
    }
    try {
      const a6 = await resolve6(p.host);
      console.log("  DNS AAAA (IPv6):", a6[0]);
    } catch (e) {
      console.log("  DNS AAAA (IPv6): (none or not published)", e.code || e.message);
    }
    const tcp = await tcpProbe(p.host, p.port, 8000);
    console.log("  TCP connect:", tcp.ok ? "reachable" : `FAILED (${tcp.reason || "unknown"})`);
    console.log("");
  }

  console.log("If you see P1001 on BOTH hosts:");
  console.log("  1) Fix pooler hostname: never guess — copy from Supabase → Database (Transaction pooler).");
  console.log("  2) Ensure the project is not paused (free tier) and the DB password in the URL is current.");
  console.log("  3) Windows / IPv6: try before prisma:  $env:NODE_OPTIONS='--dns-result-order=ipv4first'");
  console.log("  4) Firewall: allow Node/outbound to ports 5432 and 6543, or test another network (phone hotspot).");
  console.log("  5) After fixing env: npm run db:push:local:ipv4  →  npm run db:ping  →  npm run dev");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
