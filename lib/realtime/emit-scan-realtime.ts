import { emitServerEvent } from "@/lib/events/event-emitter";
import { broadcastScanStream, type ScanStreamMessage } from "@/lib/realtime/scan-stream-hub";

export const SCAN_STREAM_EVENT_NAMES = [
  "scan_started",
  "scan_progress",
  "scan_completed",
  "risk_calculated"
] as const;

export type ScanStreamEventName = (typeof SCAN_STREAM_EVENT_NAMES)[number];

/**
 * Persists to `events` and pushes to in-memory subscribers (same Node process).
 * Remote workers are picked up by the SSE route’s DB poller.
 */
export async function emitScanRealtime(input: {
  eventName: ScanStreamEventName | string;
  scanId: string;
  userId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<string> {
  const payload: Record<string, unknown> = {
    scanId: input.scanId,
    ...(input.payload ?? {})
  };
  const id = await emitServerEvent({
    event: input.eventName,
    userId: input.userId ?? null,
    payload
  });
  const msg: ScanStreamMessage = {
    id,
    event: input.eventName,
    scanId: input.scanId,
    ...payload
  };
  broadcastScanStream(msg);
  return id;
}
