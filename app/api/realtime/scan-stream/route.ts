import { prisma } from "@/lib/prisma";
import { safeDbResult } from "@/lib/safe-db";
import { SCAN_STREAM_EVENT_NAMES } from "@/lib/realtime/emit-scan-realtime";
import { subscribeScanStream, type ScanStreamMessage } from "@/lib/realtime/scan-stream-hub";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const encoder = new TextEncoder();

function sseData(obj: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

/**
 * Server-Sent Events stream of scan-scoped product events. Same-origin; includes DB polling
 * so a separate worker process is still visible to subscribers.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scanId = (searchParams.get("scanId") || "").trim();
  if (!scanId) {
    return new Response("scanId required", { status: 400 });
  }
  if (!/^[0-9a-fA-F-]{32,36}$/.test(scanId)) {
    return new Response("invalid scanId", { status: 400 });
  }

  let lastCursor = new Date(Date.now() - 15 * 60 * 1000);
  const seen = new Set<string>();
  const names = [...SCAN_STREAM_EVENT_NAMES];

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        sseData({ type: "connected", scanId, ts: new Date().toISOString() } as Record<string, unknown>)
      );
      const send = (msg: ScanStreamMessage) => {
        if (seen.has(msg.id)) {
          return;
        }
        seen.add(msg.id);
        controller.enqueue(sseData({ type: "scan", ...msg }));
      };
      const unsub = subscribeScanStream(scanId, send);
      const interval = setInterval(() => {
        void (async () => {
          try {
            const rowsRes = await safeDbResult(() =>
              prisma.event.findMany({
                where: {
                  event: { in: names },
                  createdAt: { gt: lastCursor }
                },
                orderBy: { createdAt: "asc" },
                take: 200
              })
            );
            if (!rowsRes.ok) {
              return;
            }
            const rows = rowsRes.value;
            const forScan = rows.filter((row) => {
              const p = row.properties;
              if (!p || typeof p !== "object" || p === null) {
                return false;
              }
              return (p as { scanId?: string }).scanId === scanId;
            });
            for (const row of forScan) {
              if (seen.has(row.id)) {
                continue;
              }
              seen.add(row.id);
              const p = (row.properties ?? {}) as Record<string, unknown>;
              const msg: ScanStreamMessage = {
                id: row.id,
                event: row.event,
                scanId: String(p.scanId ?? scanId),
                ...p
              };
              controller.enqueue(sseData({ type: "scan", ...msg }));
            }
            if (rows.length) {
              const last = rows[rows.length - 1]!;
              lastCursor = last.createdAt;
            }
          } catch (e) {
            controller.enqueue(
              sseData({
                type: "error",
                message: e instanceof Error ? e.message : "poll_failed"
              })
            );
          }
        })();
      }, 500);
      request.signal.addEventListener(
        "abort",
        () => {
          clearInterval(interval);
          unsub();
          try {
            controller.close();
          } catch {
            // ignore
          }
        },
        { once: true }
      );
    }
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
