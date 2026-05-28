import { prisma } from "@/lib/prisma";
import { safeDbResult } from "@/lib/safe-db";

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Links an unclaimed scan to the user (by scan id and/or matching email).
 * Used after signup/login and on session load so dashboard is not empty.
 */
export async function attachOrphanScanToUser(input: {
  userId: string;
  email: string;
  publicScanId?: string | null;
}): Promise<string | null> {
  const userId = input.userId.trim();
  const email = normEmail(input.email);
  const preferredId = input.publicScanId?.trim() || null;
  if (!userId || !email) {
    return null;
  }

  const existing = await safeDbResult(() =>
    prisma.scan.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { publicScanId: true }
    })
  );
  if (existing.ok && existing.value) {
    return existing.value.publicScanId;
  }

  const linkRes = await safeDbResult(async () => {
    if (preferredId) {
      const row = await prisma.scan.findFirst({
        where: { publicScanId: preferredId, userId: null }
      });
      if (row) {
        const onScan = row.email?.trim() ? normEmail(row.email) : null;
        if (onScan && onScan !== email) {
          return null;
        }
        await prisma.scan.update({
          where: { id: row.id },
          data: { userId, email }
        });
        return preferredId;
      }
    }

    const orphan = await prisma.scan.findFirst({
      where: {
        userId: null,
        email: { equals: email, mode: "insensitive" }
      },
      orderBy: { createdAt: "desc" }
    });
    if (!orphan) {
      return null;
    }
    await prisma.scan.update({
      where: { id: orphan.id },
      data: { userId, email }
    });
    return orphan.publicScanId;
  });

  return linkRes.ok ? linkRes.value : null;
}
