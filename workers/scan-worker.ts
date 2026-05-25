/**
 * One-shot worker: run `npx tsx workers/scan-worker.ts` (or `npm run worker:scan`) with
 * `DATABASE_URL` and after `npx prisma generate`. Processes up to 50 pending jobs then exits.
 *
 * Scan stage events + `events` row writes: `lib/queue/scan-queue.ts` and `lib/server/create-scan-db.ts`
 * (`emitScanRealtime`). Clients subscribe with GET `/api/realtime/scan-stream?scanId=…` and poll the same rows.
 */
import { processScanJobs } from "../lib/queue/scan-queue";

const limit = Math.min(100, Math.max(1, Number(process.env.SCAN_WORKER_BATCH) || 50));

void processScanJobs(limit)
  .then((n) => {
    // eslint-disable-next-line no-console
    console.log(`[scan-worker] processed ${n} job(s)`);
    process.exit(0);
  })
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error("[scan-worker]", e);
    process.exit(1);
  });
