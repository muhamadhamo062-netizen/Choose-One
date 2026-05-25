import { getCostBreakdown } from "@/lib/analytics/cost/cost-meter";

type BudgetStatus = "allowed" | "throttled" | "exceeded";

type BudgetResult = {
  status: BudgetStatus;
  allowed: boolean;
  throttled: boolean;
  exceeded: boolean;
  usage: number;
  budget: number;
};

function readBudget(envName: string, fallback: number): number {
  const n = Number(process.env[envName] ?? "");
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return Math.floor(n);
}

function evaluate(usage: number, budget: number): BudgetResult {
  const ratio = budget > 0 ? usage / budget : 0;
  const status: BudgetStatus = ratio >= 1 ? "exceeded" : ratio >= 0.8 ? "throttled" : "allowed";
  return {
    status,
    allowed: status === "allowed",
    throttled: status === "throttled",
    exceeded: status === "exceeded",
    usage,
    budget
  };
}

export function getBudgetStatus() {
  const b = getCostBreakdown();
  return {
    analyticsWrites: evaluate(b.dbWrites, readBudget("ANALYTICS_WRITES_BUDGET_PER_MIN", 1200)),
    projectionJobs: evaluate(b.projectionJobs, readBudget("PROJECTION_JOBS_BUDGET_PER_MIN", 1000)),
    replay: evaluate(b.replayExecutions, readBudget("REPLAY_BUDGET_PER_MIN", 100)),
    replication: evaluate(b.replicationEvents, readBudget("REPLICATION_BUDGET_PER_MIN", 1500))
  };
}
