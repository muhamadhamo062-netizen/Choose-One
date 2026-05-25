import { prisma } from "@/lib/prisma";
import { safeDbResult } from "@/lib/safe-db";

const DEFAULT_COMMISSION_CENTS = 3000;
export type ReferralConversionAudit =
  | { status: "no_pending_referral" }
  | { status: "rejected_self"; referralId: string; affiliateId: string; buyerEmail: string }
  | {
      status: "converted";
      referralId: string;
      affiliateId: string;
      referralCode: string;
      buyerEmail: string;
      commissionCents: number;
      saleAmountCents: number;
      paymentEventId: string | null;
      paymentTransactionId: string | null;
    };

async function resolveValidAffiliateForReferral(input: { buyerEmail: string; referralCode: string }): Promise<{
  affiliateId: string;
  referralCode: string;
  affiliateEmail: string;
} | null> {
  const normalizedEmail = input.buyerEmail.trim().toLowerCase();
  const normalizedCode = input.referralCode.trim().toLowerCase();
  if (!normalizedEmail || !normalizedCode) {
    return null;
  }
  const affiliate = await prisma.affiliate.findUnique({
    where: { code: normalizedCode },
    select: { id: true, code: true, email: true }
  });
  if (!affiliate) {
    return null;
  }
  if (affiliate.email.toLowerCase() === normalizedEmail) {
    return null;
  }
  return { affiliateId: affiliate.id, referralCode: affiliate.code, affiliateEmail: affiliate.email };
}

export async function attachReferralToUser(email: string, userId: string, refCode: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = refCode.trim().toLowerCase();
  if (!normalizedEmail || !normalizedCode) {
    return;
  }

  const resolved = await resolveValidAffiliateForReferral({ buyerEmail: normalizedEmail, referralCode: normalizedCode });
  if (!resolved) {
    return;
  }

  const existingRes = await safeDbResult(() =>
    prisma.referral.findFirst({
      where: {
        affiliateId: resolved.affiliateId,
        OR: [{ userId }, { buyerEmail: normalizedEmail }]
      },
      orderBy: { createdAt: "desc" }
    })
  );
  if (existingRes.ok && existingRes.value) {
    return;
  }

  await safeDbResult(() =>
    prisma.user.updateMany({
      where: { id: userId, referredByCode: null },
      data: {
        referredByCode: resolved.referralCode
      }
    })
  );

  await safeDbResult(() =>
    prisma.referral.create({
      data: {
        affiliateId: resolved.affiliateId,
        userId,
        buyerEmail: normalizedEmail,
        referralCode: resolved.referralCode,
        status: "pending",
        commissionCents: DEFAULT_COMMISSION_CENTS
      }
    })
  );
}

export async function recordReferralConversionTx(
  tx: typeof prisma,
  input: { email: string; paymentEventId?: string; paymentTransactionId?: string; saleAmountCents?: number }
): Promise<ReferralConversionAudit> {
  const email = input.email.trim().toLowerCase();
  if (!email) {
    return { status: "no_pending_referral" };
  }
  const pending = await tx.referral.findFirst({
    where: { buyerEmail: email, status: "pending" },
    orderBy: { createdAt: "desc" }
  });
  if (!pending) {
    return { status: "no_pending_referral" };
  }

  const affiliate = await tx.affiliate.findUnique({
    where: { id: pending.affiliateId },
    select: { email: true }
  });
  if (affiliate?.email?.toLowerCase() === email) {
    await tx.referral.update({
      where: { id: pending.id },
      data: {
        status: "rejected_self",
        stripeEventId: input.paymentEventId ?? pending.stripeEventId,
        stripePaymentId: input.paymentTransactionId ?? pending.stripePaymentId,
        saleAmountCents: input.saleAmountCents ?? pending.saleAmountCents
      }
    });
    return { status: "rejected_self", referralId: pending.id, affiliateId: pending.affiliateId, buyerEmail: email };
  }

  const commissionCents = pending.commissionCents > 0 ? pending.commissionCents : DEFAULT_COMMISSION_CENTS;
  await tx.referral.update({
    where: { id: pending.id },
    data: {
      status: "converted",
      convertedAt: new Date(),
      stripeEventId: input.paymentEventId ?? pending.stripeEventId,
      stripePaymentId: input.paymentTransactionId ?? pending.stripePaymentId,
      saleAmountCents: input.saleAmountCents ?? pending.saleAmountCents,
      commissionCents
    }
  });
  await tx.affiliate.update({
    where: { id: pending.affiliateId },
    data: {
      commissionCents: {
        increment: commissionCents
      }
    }
  });
  return {
    status: "converted",
    referralId: pending.id,
    affiliateId: pending.affiliateId,
    referralCode: pending.referralCode,
    buyerEmail: email,
    commissionCents,
    saleAmountCents: input.saleAmountCents ?? pending.saleAmountCents ?? 0,
    paymentEventId: input.paymentEventId ?? pending.stripeEventId ?? null,
    paymentTransactionId: input.paymentTransactionId ?? pending.stripePaymentId ?? null
  };
}

export async function recordReferralConversion(input: {
  email: string;
  paymentEventId?: string;
  paymentTransactionId?: string;
  saleAmountCents?: number;
}): Promise<ReferralConversionAudit> {
  return prisma.$transaction(async (tx) => {
    return recordReferralConversionTx(tx, input);
  });
}

export async function markAffiliatePayoutPaid(affiliateId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const referrals = await tx.referral.findMany({
      where: {
        affiliateId,
        status: "converted",
        payoutStatus: "unpaid"
      },
      select: {
        id: true,
        commissionCents: true
      }
    });
    if (referrals.length === 0) {
      return 0;
    }

    const total = referrals.reduce((sum, item) => sum + item.commissionCents, 0);
    await tx.referral.updateMany({
      where: {
        affiliateId,
        status: "converted",
        payoutStatus: "unpaid"
      },
      data: {
        payoutStatus: "paid",
        paidAt: new Date()
      }
    });
    await tx.affiliate.update({
      where: { id: affiliateId },
      data: {
        commissionCents: {
          decrement: total
        }
      }
    });
    return total;
  });
}

export async function ensurePendingReferralForBuyer(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return;
  }
  const existing = await prisma.referral.findFirst({
    where: {
      buyerEmail: normalizedEmail,
      status: {
        in: ["pending", "converted"]
      }
    },
    select: { id: true }
  });
  if (existing) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, referredByCode: true }
  });
  if (!user?.referredByCode) {
    return;
  }
  await attachReferralToUser(normalizedEmail, user.id, user.referredByCode);
}
