import type { Prisma } from "@prisma/client";
import { enqueueFunnelEvent } from "@/lib/events/ingest-queue";

const MAX_EVENT_NAME_LEN = 256;

/** Ensures Prisma `Json` column receives only JSON-serializable content (avoids client-side runtime surprises). */
function toInputJsonValue(payload: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
}

/**
 * Enqueues a server event for async persistence. Never rejects; returns an id immediately (optimistic).
 * DB write runs in the funnel ingest worker — failures are retried there and must not block callers.
 */
export async function emitServerEvent(input: {
  event: string;
  userId?: string | null;
  payload: Record<string, unknown>;
}): Promise<string> {
  try {
    const event = input.event.slice(0, MAX_EVENT_NAME_LEN);
    const userId = input.userId == null || typeof input.userId === "string" ? input.userId ?? null : null;
    const payload = toInputJsonValue(input.payload);
    const id = crypto.randomUUID();
    enqueueFunnelEvent({ id, event, userId, properties: payload });
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info("[PE Event]", { event, userId, ...input.payload });
    }
    return id;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[emitServerEvent] enqueue failed", e);
    return `local_${crypto.randomUUID()}`;
  }
}
