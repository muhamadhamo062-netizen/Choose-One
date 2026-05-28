/**
 * Owner/dev: set a known password for an email (fixes accounts with random hash from old checkout).
 *
 *   node scripts/reset-user-password.cjs you@example.com YourNewPassword8
 *
 * Requires DATABASE_URL + DIRECT_URL in .env.local (same as db:ping).
 */
const { PrismaClient } = require("@prisma/client");
const { hash } = require("bcryptjs");
const { loadProjectEnv } = require("./load-project-env.cjs");

function normalizeAuthEmail(raw) {
  return raw
    .normalize("NFKC")
    .trim()
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u00A0]/g, "")
    .toLowerCase();
}

const loaded = loadProjectEnv();
if (!loaded.ok) {
  console.error(loaded.message);
  process.exit(1);
}

const emailArg = process.argv[2];
const passwordArg = process.argv[3];
if (!emailArg || !passwordArg) {
  console.error("Usage: node scripts/reset-user-password.cjs <email> <password>");
  process.exit(1);
}

const email = normalizeAuthEmail(emailArg);
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Invalid email:", emailArg);
  process.exit(1);
}
if (passwordArg.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const legacy = await prisma.user.findFirst({
      where: { email: { startsWith: email, mode: "insensitive" } }
    });
    if (legacy && normalizeAuthEmail(legacy.email) === email) {
      user = legacy;
    }
  }
  if (!user) {
    console.error("No user found for:", email);
    process.exit(1);
  }
  const passwordHash = await hash(passwordArg, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { email, passwordHash }
  });
  console.log("Password updated for", email, "(user id:", user.id + ")");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
