import type { PrismaClient } from "@prisma/client";
import { normalizeAuthEmail } from "@/lib/normalize-auth-email";

export type AuthUserRow = {
  id: string;
  email: string;
  fullName: string | null;
  passwordHash: string | null;
};

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  passwordHash: true
} as const;

/**
 * Lookup by normalized email; also matches legacy rows saved with invisible Unicode after paste (e.g. RTL mark).
 * Heals stored email when a legacy match is found.
 */
export async function findUserByAuthEmail(db: PrismaClient, rawEmail: string): Promise<AuthUserRow | null> {
  const normalized = normalizeAuthEmail(rawEmail);
  if (!normalized) {
    return null;
  }

  const direct = await db.user.findUnique({
    where: { email: normalized },
    select: userSelect
  });
  if (direct) {
    return direct;
  }

  const legacy = await db.user.findFirst({
    where: {
      email: { startsWith: normalized, mode: "insensitive" }
    },
    select: userSelect
  });
  if (!legacy || normalizeAuthEmail(legacy.email) !== normalized) {
    return null;
  }

  if (legacy.email !== normalized) {
    await db.user.update({
      where: { id: legacy.id },
      data: { email: normalized }
    });
    return { ...legacy, email: normalized };
  }

  return legacy;
}
