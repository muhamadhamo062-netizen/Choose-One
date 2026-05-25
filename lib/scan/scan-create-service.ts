import { enqueueScan, processScanJobs } from "@/lib/queue/scan-queue";

export type ScanCreateBody = { fullName?: string; email?: string; stateCode?: string };

export function validateScanCreateBody(body: unknown):
  | { ok: true; fullName: string; email: string | undefined; stateCode: string }
  | { ok: false; error: string; status: number } {
  const b = body as ScanCreateBody;
  const stateCode = typeof b.stateCode === "string" ? b.stateCode.trim() : "";
  if (!stateCode) {
    return { ok: false, error: "state_required", status: 400 };
  }
  const fullName = typeof b.fullName === "string" ? b.fullName.trim() : "";
  const email = typeof b.email === "string" && b.email.trim() ? b.email.trim() : undefined;
  return { ok: true, fullName, email, stateCode };
}

/**
 * Enqueues a scan; worker or cron processes the job. `scanId` in the response
 * is the public id used for cookies and `GET /api/scan/status`.
 */
export async function dispatchScanCreate(input: {
  fullName: string;
  email?: string;
  stateCode: string;
  userId: string | null;
}): Promise<{ scanId: string; jobId: string; status: "pending" }> {
  const { publicScanId, jobId } = await enqueueScan({
    userId: input.userId,
    fullName: input.fullName,
    email: input.email,
    stateCode: input.stateCode,
    kind: "initial"
  });
  if (process.env.PE_DEV_PROCESS_QUEUE_INLINE === "1" || process.env.PE_DEV_PROCESS_QUEUE_INLINE === "true") {
    await processScanJobs(5);
  }
  return { scanId: publicScanId, jobId, status: "pending" };
}
