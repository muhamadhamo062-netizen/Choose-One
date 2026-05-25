type CostBucket = {
  startedAt: number;
  dbReads: number;
  dbWrites: number;
  queueOps: number;
  projectionJobs: number;
  replayExecutions: number;
  replicationEvents: number;
};

const WINDOW_MS = 60_000;
const bucket: CostBucket = {
  startedAt: Date.now(),
  dbReads: 0,
  dbWrites: 0,
  queueOps: 0,
  projectionJobs: 0,
  replayExecutions: 0,
  replicationEvents: 0
};

function ensureWindow(): void {
  if (Date.now() - bucket.startedAt < WINDOW_MS) {
    return;
  }
  bucket.startedAt = Date.now();
  bucket.dbReads = 0;
  bucket.dbWrites = 0;
  bucket.queueOps = 0;
  bucket.projectionJobs = 0;
  bucket.replayExecutions = 0;
  bucket.replicationEvents = 0;
}

export function trackCost(
  type: "dbReads" | "dbWrites" | "queueOps" | "projectionJobs" | "replayExecutions" | "replicationEvents",
  amount = 1
): void {
  ensureWindow();
  bucket[type] += Math.max(0, Math.floor(amount));
}

export function getCostBreakdown() {
  ensureWindow();
  return {
    windowStartedAt: new Date(bucket.startedAt).toISOString(),
    dbReads: bucket.dbReads,
    dbWrites: bucket.dbWrites,
    queueOps: bucket.queueOps,
    projectionJobs: bucket.projectionJobs,
    replayExecutions: bucket.replayExecutions,
    replicationEvents: bucket.replicationEvents
  };
}

export function getCurrentCostPressure(): number {
  ensureWindow();
  const weighted =
    bucket.dbReads * 0.5 +
    bucket.dbWrites * 1.2 +
    bucket.queueOps * 0.8 +
    bucket.projectionJobs * 1.1 +
    bucket.replayExecutions * 2.0 +
    bucket.replicationEvents * 0.9;
  return Math.max(0, Math.min(100, Math.round(weighted / 25)));
}
