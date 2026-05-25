import { NextResponse } from "next/server";
import { emitServerEvent } from "@/lib/events/event-emitter";
import { computeMaterializedFromRawEvents, readMaterializedMetrics, replaceMaterializedMetrics } from "@/lib/analytics/materialized-metrics";

export const dynamic = "force-dynamic";

/**
 * Repair tool only.
 * Correctness should come from event queue + projection worker, not this endpoint.
 */

function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return true;
  }
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const [current, recomputed] = await Promise.all([readMaterializedMetrics(), computeMaterializedFromRawEvents()]);
    const hasMismatch =
      current.global.totalScans !== recomputed.global.totalScans ||
      current.global.totalSourcesFound !== recomputed.global.totalSourcesFound ||
      current.global.totalRemovalRequests !== recomputed.global.totalRemovalRequests ||
      current.global.verifiedRemovals !== recomputed.global.verifiedRemovals ||
      current.global.rejectedEvents !== recomputed.global.rejectedEvents ||
      current.global.duplicateEvents !== recomputed.global.duplicateEvents ||
      current.scans.length !== recomputed.scans.length;

    if (hasMismatch) {
      await replaceMaterializedMetrics(recomputed);
      await emitServerEvent({
        event: "analytics_metrics_sync_corrected",
        payload: {
          correctedAt: new Date().toISOString(),
          previous: current.global,
          next: recomputed.global
        }
      });
    }
    return NextResponse.json({ ok: true, corrected: hasMismatch, mode: "repair_only" });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("DB ERROR:", error);
    return NextResponse.json({ ok: false, error: "sync_skipped" }, { status: 200 });
  }
}
