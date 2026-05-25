import { prisma } from "@/lib/prisma";
import { safeDbResult } from "@/lib/safe-db";

const DEFAULT_RETENTION_HOURS = 24;

function resolveRetentionHours(rawHours?: number): number {
  const envHours = Number(process.env.SENSITIVE_DATA_RETENTION_HOURS ?? process.env.PE_SENSITIVE_TTL_HOURS ?? "");
  const candidate = Number.isFinite(rawHours) && rawHours && rawHours > 0 ? rawHours : envHours;
  if (!Number.isFinite(candidate) || candidate <= 0) {
    return DEFAULT_RETENTION_HOURS;
  }
  return Math.max(1, Math.floor(candidate));
}

export async function cleanupSensitiveData(input?: { olderThanHours?: number }) {
  const olderThanHours = resolveRetentionHours(input?.olderThanHours);
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

  const txRes = await safeDbResult(() =>
    prisma.$transaction([
      prisma.scan.deleteMany({
        where: { createdAt: { lt: cutoff } }
      }),
      prisma.scanJob.deleteMany({
        where: { createdAt: { lt: cutoff } }
      })
    ])
  );
  if (!txRes.ok) {
    return {
      ok: false as const,
      olderThanHours,
      deleted: { scans: 0, scanJobs: 0 }
    };
  }
  const [scanDelete, scanJobDelete] = txRes.value;

  return {
    ok: true as const,
    olderThanHours,
    deleted: {
      scans: scanDelete.count,
      scanJobs: scanJobDelete.count
    }
  };
}
