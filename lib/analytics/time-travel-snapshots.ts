import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

type SnapshotEventType = "scan_completed" | "verification_completed";

function stateHash(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

async function computeSnapshotHash(scanId: string, eventCursor: number): Promise<string> {
  const events = await prisma.analyticsEvent.findMany({
    where: { scanId },
    orderBy: { createdAt: "asc" },
    take: eventCursor,
    select: { eventId: true, type: true, createdAt: true }
  });
  return createHash("sha256")
    .update(
      events
        .map((e) => `${e.eventId}:${e.type}:${e.createdAt.toISOString()}`)
        .join("|")
    )
    .digest("hex");
}

export async function writeTimeTravelSnapshot(input: {
  scanId: string;
  eventId: string;
  eventType: SnapshotEventType;
  eventCursor: number;
  materializedState: Record<string, unknown>;
}): Promise<void> {
  const derivedStateHash = stateHash(input.materializedState);
  const snapshotHash = await computeSnapshotHash(input.scanId, input.eventCursor);
  const exists = await prisma.analyticsTimeTravelSnapshot.findFirst({
    where: { scanId: input.scanId, eventId: input.eventId },
    select: { id: true }
  });
  if (exists) {
    return;
  }
  await prisma.analyticsTimeTravelSnapshot.create({
    data: {
      scanId: input.scanId,
      eventId: input.eventId,
      eventType: input.eventType,
      eventCursor: input.eventCursor,
      materializedState: input.materializedState,
      derivedStateHash,
      snapshotHash
    }
  });
}

export async function advanceReplayCursorIfValid(input: {
  scanId: string;
  eventCursor: number;
  eventId: string;
  state: string;
  derivedStateHash: string;
  isConsistent: boolean;
}): Promise<void> {
  if (!input.isConsistent) {
    return;
  }
  const current = await prisma.analyticsReplayCursor.findUnique({ where: { scanId: input.scanId } });
  if (current && input.eventCursor <= current.lastEventCursor) {
    return;
  }
  await prisma.analyticsReplayCursor.upsert({
    where: { scanId: input.scanId },
    create: {
      scanId: input.scanId,
      lastEventCursor: input.eventCursor,
      lastEventId: input.eventId,
      lastState: input.state,
      derivedStateHash: input.derivedStateHash
    },
    update: {
      lastEventCursor: input.eventCursor,
      lastEventId: input.eventId,
      lastState: input.state,
      derivedStateHash: input.derivedStateHash
    }
  });
}

export async function getReplayCursor(scanId: string): Promise<{
  lastEventCursor: number;
  lastEventId: string | null;
  lastState: string | null;
  derivedStateHash: string | null;
}> {
  const row = await prisma.analyticsReplayCursor.findUnique({ where: { scanId } });
  return {
    lastEventCursor: row?.lastEventCursor ?? 0,
    lastEventId: row?.lastEventId ?? null,
    lastState: row?.lastState ?? null,
    derivedStateHash: row?.derivedStateHash ?? null
  };
}

export async function getTimeTravelSnapshots(scanId: string) {
  return prisma.analyticsTimeTravelSnapshot.findMany({
    where: { scanId },
    orderBy: { eventCursor: "asc" }
  });
}
