import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { linkPendingJobToUser } from "@/lib/queue/scan-queue";
import { emitServerEvent } from "@/lib/events/event-emitter";
import { safeDbResult } from "@/lib/safe-db";
import { enqueueRemovalJobsForUser, executePendingRemovalJobs } from "@/lib/removal-engine";

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

export type LifetimeEntitlementResult = { userId: string; email: string; fullName: string | null };

/**
 * Single DB path for lifetime plan after verified payment (webhook) or dev-only unverified path.
 * When `paddleTransactionId` is set, it is the server-verified payment reference.
 */
export async function fulfillLifetimeEntitlement(input: {
  email: string;
  linkPublicScanId: string | null;
  paddleTransactionId: string | null;
}): Promise<LifetimeEntitlementResult> {
  const email = normEmail(input.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("invalid_email");
  }

  const linkScanId = input.linkPublicScanId?.trim() || null;
  const paddleTx = input.paddleTransactionId?.trim() || null;

  type ScanPre = {
    id: string;
    publicScanId: string;
    userId: string | null;
    email: string | null;
    fullName: string | null;
  };
  let scanToLink: ScanPre | null = null;

  if (linkScanId) {
    const sRes = await safeDbResult(() =>
      prisma.scan.findFirst({
        where: { publicScanId: linkScanId },
        select: { id: true, publicScanId: true, userId: true, email: true, fullName: true }
      })
    );
    if (!sRes.ok) {
      throw new Error("database_unavailable");
    }
    const s = sRes.value;
    if (s) {
      if (s.userId) {
        const ownerRes = await safeDbResult(() => prisma.user.findUnique({ where: { id: s.userId } }));
        if (!ownerRes.ok) {
          throw new Error("database_unavailable");
        }
        const owner = ownerRes.value;
        if (owner && normEmail(owner.email) !== email) {
          throw new Error("scan_attached_to_other_user");
        }
      } else {
        const onScan = s.email?.trim() ? normEmail(s.email) : null;
        if (onScan && onScan !== email) {
          throw new Error("email_mismatch_with_scan");
        }
        scanToLink = s;
      }
    }
  }

  if (paddleTx) {
    const dupeRes = await safeDbResult(() =>
      prisma.subscription.findFirst({ where: { paddleTransactionId: paddleTx } })
    );
    if (!dupeRes.ok) {
      throw new Error("database_unavailable");
    }
    const dupe = dupeRes.value;
    if (dupe) {
      const uRes = await safeDbResult(() => prisma.user.findUnique({ where: { id: dupe.userId } }));
      if (!uRes.ok) {
        throw new Error("database_unavailable");
      }
      const u = uRes.value;
      if (u) {
        return { userId: u.id, email: u.email, fullName: u.fullName };
      }
    }
  }

  const randomPassword = () => randomBytes(32).toString("base64url");

  const userRowRes = await safeDbResult(() =>
    prisma.$transaction(async (tx) => {
    let u = await tx.user.findUnique({ where: { email } });

    if (!u) {
      const passwordHash = await hash(randomPassword(), 12);
      const fullName = scanToLink?.fullName?.trim() || email.split("@")[0] || "Member";
      u = await tx.user.create({
        data: { email, passwordHash, fullName }
      });
      await tx.subscription.create({
        data: {
          userId: u.id,
          plan: "lifetime",
          status: "active",
          paddleTransactionId: paddleTx
        }
      });
    } else {
      const sub = await tx.subscription.findFirst({
        where: { userId: u.id },
        orderBy: { startedAt: "desc" }
      });
      if (sub) {
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            plan: "lifetime",
            status: "active",
            ...(paddleTx ? { paddleTransactionId: paddleTx } : {})
          }
        });
      } else {
        await tx.subscription.create({
          data: {
            userId: u.id,
            plan: "lifetime",
            status: "active",
            paddleTransactionId: paddleTx
          }
        });
      }
    }

    if (linkScanId && scanToLink) {
      const row = await tx.scan.findFirst({
        where: { publicScanId: linkScanId, userId: null }
      });
      if (row) {
        await tx.scan.update({
          where: { id: row.id },
          data: { userId: u.id, email }
        });
      }
    } else if (linkScanId && !scanToLink) {
      const already = await tx.scan.findFirst({ where: { publicScanId: linkScanId, userId: u.id } });
      if (!already) {
        const unclaimed = await tx.scan.findFirst({ where: { publicScanId: linkScanId, userId: null } });
        if (unclaimed) {
          const onScan = unclaimed.email?.trim() ? normEmail(unclaimed.email) : null;
          if (onScan && onScan !== email) {
            throw new Error("email_mismatch_with_scan");
          }
          await tx.scan.update({
            where: { id: unclaimed.id },
            data: { userId: u.id, email }
          });
        }
      }
    }

    return { id: u.id, email: u.email, fullName: u.fullName };
    })
  );
  if (!userRowRes.ok) {
    throw new Error("database_unavailable");
  }
  const userRow = userRowRes.value;

  if (linkScanId) {
    try {
      await linkPendingJobToUser(linkScanId, userRow.id);
    } catch (e) {
      console.error("[fulfillLifetime] link job", e);
    }
  }

  void emitServerEvent({
    event: "signup_completed",
    userId: userRow.id,
    payload: {
      email: userRow.email,
      source: paddleTx ? "paddle_webhook" : "unverified_client",
      scanId: linkScanId || ""
    }
  });

  // Start real broker opt-out execution as soon as lifetime entitlement is active.
  void enqueueRemovalJobsForUser({
    userId: userRow.id,
    scanId: linkScanId
  }).then(() => executePendingRemovalJobs(25));

  return { userId: userRow.id, email: userRow.email, fullName: userRow.fullName };
}
