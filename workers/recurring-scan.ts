/**
 * Nightly (or on-demand) job: enqueues 7-day re-scans for active paid users, then processes jobs.
 * Run: `npx tsx workers/recurring-scan.ts` or `npm run worker:recurring`
 */
import { enqueueDueRecurringScansForActiveSubscribers } from "../lib/queue/recurring-scans";
import { processScanJobs } from "../lib/queue/scan-queue";

const limit = Math.min(100, Math.max(1, Number(process.env.SCAN_WORKER_BATCH) || 50));

async function main() {
  const { enqueued } = await enqueueDueRecurringScansForActiveSubscribers();
  // eslint-disable-next-line no-console
  console.log(`[recurring-scan] enqueued ${enqueued} recurring job(s)`);
  const n = await processScanJobs(limit);
  // eslint-disable-next-line no-console
  console.log(`[recurring-scan] processed ${n} job(s)`);
}

void main()
  .then(() => process.exit(0))
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error("[recurring-scan]", e);
    process.exit(1);
  });
