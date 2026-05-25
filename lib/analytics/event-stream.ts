type AnalyticsBroadcastEvent = {
  eventId: string;
  scanId: string | null;
  type: string;
  createdAt: string;
};

type Listener = (event: AnalyticsBroadcastEvent) => void;

const globalListeners = new Set<Listener>();
const scanListeners = new Map<string, Set<Listener>>();

function emitAsync(listener: Listener, event: AnalyticsBroadcastEvent): void {
  queueMicrotask(() => {
    try {
      listener(event);
    } catch (error) {
      // Observability channel only: never throw to core flow.
      // eslint-disable-next-line no-console
      console.warn("[event-stream] listener_emit_failed", {
        type: event.type,
        scanId: event.scanId,
        error: error instanceof Error ? error.message : String(error)
      });
      setTimeout(() => {
        try {
          listener(event);
        } catch {
          // eslint-disable-next-line no-console
          console.warn("[event-stream] listener_retry_failed", { type: event.type, scanId: event.scanId });
        }
      }, 250);
    }
  });
}

export function publishEvent(event: AnalyticsBroadcastEvent): void {
  for (const listener of globalListeners) {
    emitAsync(listener, event);
  }
  if (event.scanId) {
    const listeners = scanListeners.get(event.scanId);
    if (listeners) {
      for (const listener of listeners) {
        emitAsync(listener, event);
      }
    }
  }
}

export function subscribeToScan(scanId: string, listener: Listener): () => void {
  const set = scanListeners.get(scanId) ?? new Set<Listener>();
  set.add(listener);
  scanListeners.set(scanId, set);
  return () => {
    const cur = scanListeners.get(scanId);
    if (!cur) {
      return;
    }
    cur.delete(listener);
    if (cur.size === 0) {
      scanListeners.delete(scanId);
    }
  };
}

export function subscribeGlobal(listener: Listener): () => void {
  globalListeners.add(listener);
  return () => {
    globalListeners.delete(listener);
  };
}
