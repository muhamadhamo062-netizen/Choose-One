import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isTemporaryDbUnavailable } from "@/lib/db-failsafe";

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 40;
let eventsTableUnavailable = false;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  const exp = BASE_BACKOFF_MS * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 30);
  return exp + jitter;
}

/**
 * Best-effort persist to `events`. Retries transient / P2024; never throws to callers.
 */
export async function tryPersistFunnelEvent(data: {
  id: string;
  event: string;
  userId: string | null;
  properties: Prisma.InputJsonValue;
}): Promise<boolean> {
  if (eventsTableUnavailable) {
    return false;
  }
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      await prisma.event.create({
        data: {
          id: data.id,
          event: data.event,
          userId: data.userId,
          properties: data.properties
        }
      });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return true;
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
        // Events table is not present in this environment; disable further writes this runtime.
        eventsTableUnavailable = true;
        return false;
      }
      const retryable =
        isTemporaryDbUnavailable(e) ||
        (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2024" || e.code === "P2034"));
      const last = attempt === MAX_ATTEMPTS - 1;
      if (!retryable) {
        // eslint-disable-next-line no-console
        console.error("[tryPersistFunnelEvent] non-retryable", e);
        return false;
      }
      if (!last) {
        await delay(backoffMs(attempt));
        continue;
      }
      // eslint-disable-next-line no-console
      console.error("[tryPersistFunnelEvent] giving up", { id: data.id, event: data.event });
      return false;
    }
  }
  return false;
}
