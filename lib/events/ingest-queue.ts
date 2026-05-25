import type { Prisma } from "@prisma/client";
import { tryPersistFunnelEvent } from "@/lib/events/persist-event";

type IngestItem = {
  id: string;
  event: string;
  userId: string | null;
  properties: Prisma.InputJsonValue;
  deliveries: number;
};

const g = globalThis as unknown as {
  __funnelIngestQueue?: IngestItem[];
  __funnelIngestDraining?: boolean;
  __funnelIngestScheduled?: boolean;
};

function maxQueueSize(): number {
  const raw = Number(process.env.EVENTS_INGEST_MAX_QUEUE ?? "100000");
  if (!Number.isFinite(raw) || raw < 1) {
    return 100_000;
  }
  return Math.floor(Math.min(raw, 1_000_000));
}

/** Full persist cycles (each runs internal Prisma retries) before the item is dropped. */
const MAX_OUTER_DELIVERIES = 4;

const queue: IngestItem[] = (g.__funnelIngestQueue ??= []);

function scheduleDrain(): void {
  if (g.__funnelIngestScheduled) {
    return;
  }
  g.__funnelIngestScheduled = true;
  queueMicrotask(() => {
    g.__funnelIngestScheduled = false;
    void drainOnce();
  });
}

async function drainOnce(): Promise<void> {
  if (g.__funnelIngestDraining) {
    return;
  }
  g.__funnelIngestDraining = true;
  try {
    const batch = 32;
    let n = 0;
    while (queue.length > 0 && n < batch) {
      const item = queue.shift();
      if (!item) {
        break;
      }
      n += 1;
      const ok = await tryPersistFunnelEvent({
        id: item.id,
        event: item.event,
        userId: item.userId,
        properties: item.properties
      });
      if (!ok) {
        item.deliveries += 1;
        if (item.deliveries < MAX_OUTER_DELIVERIES) {
          queue.push(item);
        } else if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.warn("[funnel-ingest] dropped after max deliveries", item.event, item.id);
        }
      }
    }
  } finally {
    g.__funnelIngestDraining = false;
  }
  if (queue.length > 0) {
    setImmediate(() => {
      g.__funnelIngestScheduled = false;
      void drainOnce();
    });
  }
}

export type FunnelIngestStatus = "queued" | "dropped";

/**
 * In-memory queue for `Event` rows (funnel / audit). Survives per-process; decoupled from HTTP.
 * On overflow, newest events are dropped — no impact on the caller response contract.
 * For Redis-backed durable queues, set EVENTS_INGEST_MAX_QUEUE / external worker in infrastructure.
 */
export function enqueueFunnelEvent(input: {
  id: string;
  event: string;
  userId: string | null;
  properties: Prisma.InputJsonValue;
}): { status: FunnelIngestStatus; id: string } {
  if (queue.length >= maxQueueSize()) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("[funnel-ingest] queue full, drop", input.event);
    }
    return { status: "dropped", id: input.id };
  }
  queue.push({
    id: input.id,
    event: input.event,
    userId: input.userId,
    properties: input.properties,
    deliveries: 0
  });
  scheduleDrain();
  return { status: "queued", id: input.id };
}

/**
 * Public alias matching the "type + payload" ingress shape; distinct from `lib/analytics/event-queue` `enqueueEvent(eventId)`.
 */
export function enqueueFunnelIngestEvent(input: {
  type: string;
  userId?: string | null;
  properties: Prisma.InputJsonValue;
}): { status: FunnelIngestStatus; id: string } {
  const id = crypto.randomUUID();
  return enqueueFunnelEvent({
    id,
    event: input.type.slice(0, 256),
    userId: input.userId == null || typeof input.userId === "string" ? input.userId ?? null : null,
    properties: input.properties
  });
}
