import { randomUUID } from "crypto";
import { createScanInDatabase } from "@/lib/server/create-scan-db";
import { trackAnalyticsEvent } from "@/lib/analytics/analytics-events";
import { emitScanRealtime } from "@/lib/realtime/emit-scan-realtime";
import { prisma } from "@/lib/prisma";
import { safeDbResult } from "@/lib/safe-db";

export const MAX_SCAN_JOB_ATTEMPTS = 3;

export function useInMemoryQueue(): boolean {
  return process.env.SCAN_QUEUE_IN_MEMORY === "1" || process.env.SCAN_QUEUE_IN_MEMORY === "true";
}

type MemRow = {
  id: string;
  publicScanId: string;
  userId: string | null;
  stateCode: string;
  fullName: string;
  email: string | null;
  kind: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

const mem = {
  byId: new Map<string, MemRow>(),
  byPublic: new Map<string, string>()
};

type ClaimedJob = {
  id: string;
  publicScanId: string;
  userId: string | null;
  stateCode: string;
  fullName: string;
  email: string | null;
  kind: string;
  attempts: number;
  mem: boolean;
};

export type EnqueueScanInput = {
  userId?: string | null;
  fullName: string;
  email?: string;
  stateCode: string;
  kind?: "initial" | "recurring";
};

/**
 * Add a job; creates the client-facing `publicScanId` for cookie + status polling.
 * Emits `scan_started` after enqueue.
 */
export async function enqueueScan(
  input: EnqueueScanInput
): Promise<{ publicScanId: string; jobId: string }> {
  const publicScanId = randomUUID();
  const fullName = input.fullName;
  const email = input.email?.trim() || null;
  const stateCode = input.stateCode;
  const kind = input.kind ?? "initial";
  const userId = input.userId ?? null;

  let jobId: string;
  if (useInMemoryQueue()) {
    jobId = `mem_${randomUUID()}`;
    const row: MemRow = {
      id: jobId,
      publicScanId,
      userId,
      stateCode,
      fullName,
      email,
      kind,
      status: "pending",
      attempts: 0,
      lastError: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null
    };
    mem.byId.set(jobId, row);
    mem.byPublic.set(publicScanId, jobId);
  } else {
    const rowRes = await safeDbResult(() =>
      prisma.scanJob.create({
        data: {
          publicScanId,
          userId: userId ?? undefined,
          stateCode,
          fullName,
          email,
          kind,
          status: "pending"
        }
      })
    );
    if (!rowRes.ok) {
      throw new Error("scan_queue_unavailable");
    }
    jobId = rowRes.value.id;
  }

  await emitScanRealtime({
    eventName: "scan_started",
    scanId: publicScanId,
    userId,
    payload: { stateCode, kind }
  });
  await trackAnalyticsEvent({
    type: "scan_created",
    userId,
    scanId: publicScanId,
    metadata: { stateCode, kind, hasEmail: Boolean(email) }
  });

  return { publicScanId, jobId };
}

/** Claim the next `pending` job; moves it to `processing`. */
export async function claimNextScanJob(): Promise<ClaimedJob | null> {
  if (useInMemoryQueue()) {
    const ordered = Array.from(mem.byId.values())
      .filter((j) => j.status === "pending")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const j = ordered[0];
    if (!j) {
      return null;
    }
    j.status = "processing";
    j.startedAt = new Date();
    return { ...j, mem: true };
  }
  const claimRes = await safeDbResult(() =>
    prisma.$transaction(async (tx) => {
      const pending = await tx.scanJob.findFirst({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" }
      });
      if (!pending) {
        return null;
      }
      const u = await tx.scanJob.updateMany({
        where: { id: pending.id, status: "pending" },
        data: { status: "processing", startedAt: new Date() }
      });
      if (u.count === 0) {
        return null;
      }
      const j = await tx.scanJob.findUniqueOrThrow({ where: { id: pending.id } });
      return {
        id: j.id,
        publicScanId: j.publicScanId,
        userId: j.userId,
        stateCode: j.stateCode,
        fullName: j.fullName,
        email: j.email,
        kind: j.kind,
        attempts: j.attempts,
        mem: false
      } as ClaimedJob;
    })
  );
  return claimRes.ok ? claimRes.value : null;
}

/**
 * Run one scan job: discovery, persist Scan + ScanSession, emit `scan_completed` and `risk_calculated`.
 * Returns `true` if a job was claimed; `false` if the queue was empty.
 */
export async function processScanJob(): Promise<boolean> {
  const job = await claimNextScanJob();
  if (!job) {
    return false;
  }
  const { id, publicScanId, mem: isMem, ...data } = job;
  const userId = data.userId ?? null;
  const stateCode = data.stateCode;
  const fullName = data.fullName;
  const email = data.email ?? undefined;
  const kind = data.kind;
  let attempts = data.attempts;

  const completeOk = async () => {
    if (isMem) {
      const j = mem.byId.get(id);
      if (j) {
        j.status = "completed";
        j.completedAt = new Date();
      }
    } else {
      await safeDbResult(() =>
        prisma.scanJob.update({
          where: { id },
          data: { status: "completed", completedAt: new Date(), lastError: null }
        })
      );
    }
  };

  const fail = async (err: string) => {
    const next = attempts + 1;
    const terminal = next >= MAX_SCAN_JOB_ATTEMPTS;
    if (isMem) {
      const j = mem.byId.get(id);
      if (j) {
        j.attempts = next;
        j.lastError = err;
        if (terminal) {
          j.status = "failed";
          j.completedAt = new Date();
        } else {
          j.status = "pending";
          j.startedAt = null;
        }
      }
    } else {
      await safeDbResult(() =>
        prisma.scanJob.update({
          where: { id },
          data: {
            attempts: next,
            lastError: err,
            status: terminal ? "failed" : "pending",
            completedAt: terminal ? new Date() : null,
            startedAt: terminal ? undefined : null
          }
        })
      );
    }
  };

  try {
    await emitScanRealtime({
      eventName: "scan_progress",
      scanId: publicScanId,
      userId: userId ?? null,
      payload: { stage: "job_processing", progress: 8, kind }
    });
    const result = await createScanInDatabase({
      fullName,
      email,
      stateCode,
      userId: userId ?? null,
      publicScanId
    });
    await completeOk();
    const brokerN = result.discovery.brokerSources.length;
    await emitScanRealtime({
      eventName: "scan_completed",
      scanId: result.scanId,
      userId,
      payload: {
        stateCode: result.stateCode,
        kind,
        riskLevel: result.risk.riskLevel,
        exposureScore: result.risk.exposureScore,
        brokerCount: brokerN
      }
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await fail(err);
  }
  return true;
}

/**
 * Drains up to `limit` jobs (each `processScanJob` processes at most one per call).
 */
export async function processScanJobs(limit = 25): Promise<number> {
  let n = 0;
  for (let i = 0; i < limit; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- drain sequentially
    const did = await processScanJob();
    if (!did) {
      break;
    }
    n += 1;
  }
  return n;
}

export async function getQueueJobByPublicId(publicScanId: string) {
  if (useInMemoryQueue()) {
    const jid = mem.byPublic.get(publicScanId);
    if (!jid) {
      return null;
    }
    return mem.byId.get(jid) ?? null;
  }
  const r = await safeDbResult(() => prisma.scanJob.findUnique({ where: { publicScanId } }));
  return r.ok ? r.value : null;
}

export async function hasUserPendingRecurringJob(userId: string): Promise<boolean> {
  if (useInMemoryQueue()) {
    return Array.from(mem.byId.values()).some(
      (j) =>
        j.userId === userId &&
        j.kind === "recurring" &&
        (j.status === "pending" || j.status === "processing")
    );
  }
  const c = await safeDbResult(() =>
    prisma.scanJob.count({ where: { userId, kind: "recurring", status: { in: ["pending", "processing"] } } })
  );
  return c.ok && c.value > 0;
}

/**
 * When a user signs up with a `publicScanId` that still has a pending job, attach
 * the user so the worker's `createScanInDatabase` writes `userId` on the Scan row.
 */
export async function linkPendingJobToUser(publicScanId: string, userId: string): Promise<void> {
  if (useInMemoryQueue()) {
    const id = mem.byPublic.get(publicScanId);
    if (!id) {
      return;
    }
    const j = mem.byId.get(id);
    if (j && j.userId == null) {
      j.userId = userId;
    }
    return;
  }
  await safeDbResult(() =>
    prisma.scanJob.updateMany({
      where: { publicScanId, userId: null },
      data: { userId }
    })
  );
}
