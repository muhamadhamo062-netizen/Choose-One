/**
 * In-process fan-out for scan streaming. Cross-process workers rely on DB polling in the SSE route.
 */
type Listener = (msg: ScanStreamMessage) => void;

export type ScanStreamMessage = {
  id: string;
  event: string;
  scanId: string;
  [key: string]: unknown;
};

const byScan = new Map<string, Set<Listener>>();

export function subscribeScanStream(scanId: string, listener: Listener): () => void {
  if (!byScan.has(scanId)) {
    byScan.set(scanId, new Set());
  }
  byScan.get(scanId)!.add(listener);
  return () => {
    const set = byScan.get(scanId);
    if (!set) {
      return;
    }
    set.delete(listener);
    if (set.size === 0) {
      byScan.delete(scanId);
    }
  };
}

export function broadcastScanStream(msg: ScanStreamMessage): void {
  const set = byScan.get(msg.scanId);
  if (!set) {
    return;
  }
  for (const fn of set) {
    try {
      fn(msg);
    } catch {
      // ignore subscriber errors
    }
  }
}
