"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ScanStreamConnection = "idle" | "connecting" | "open" | "closed" | "error";

export type ScanStreamScanEvent = {
  id: string;
  event: string;
  scanId: string;
  [key: string]: unknown;
};

type StatusPayload = {
  status?: "started" | "processing" | "failed" | "completed";
  jobStatus: string;
  discovery?: unknown;
  risk?: unknown;
  lastError?: string;
  results?: {
    totalFindings: number;
    categories: {
      emails: string[];
      phones: string[];
      addresses: string[];
    };
    sources: string[];
  };
};

async function fetchScanStatus(scanId: string): Promise<StatusPayload | null> {
  const st = await fetch(`/api/scan/status?id=${encodeURIComponent(scanId)}`, {
    credentials: "include",
    cache: "no-store"
  });
  if (!st.ok) {
    return null;
  }
  return (await st.json()) as StatusPayload;
}

/**
 * Server-Sent Events for per-scan product events, with slow polling if the stream fails.
 */
export function useScanRealtime(
  scanId: string | null,
  options?: {
    /** When true, do not open EventSource */
    enabled?: boolean;
    onStreamEvent?: (ev: ScanStreamScanEvent) => void;
    onComplete?: (ctx: { scanId: string; lastEvent?: ScanStreamScanEvent }) => void;
  }
): {
  connection: ScanStreamConnection;
  lastEvent: ScanStreamScanEvent | null;
  progress: number | null;
  streamError: string | null;
  /** True when SSE is not open — caller may slow-poll */
  useFallbackPolling: boolean;
  /** Result of last successful status fetch (from stream completion or fallback) */
  statusSnapshot: StatusPayload | null;
} {
  const enabled = options?.enabled !== false && Boolean(scanId);
  const [connection, setConnection] = useState<ScanStreamConnection>("idle");
  const [lastEvent, setLastEvent] = useState<ScanStreamScanEvent | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [useFallbackPolling, setUseFallbackPolling] = useState(false);
  const [statusSnapshot, setStatusSnapshot] = useState<StatusPayload | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  const onStreamEvent = options?.onStreamEvent;
  const onComplete = options?.onComplete;
  const onStreamEventRef = useRef(onStreamEvent);
  const onCompleteRef = useRef(onComplete);
  onStreamEventRef.current = onStreamEvent;
  onCompleteRef.current = onComplete;

  const clearPollers = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (fallbackRef.current) {
      clearInterval(fallbackRef.current);
      fallbackRef.current = null;
    }
  }, []);

  useEffect(() => {
    completedRef.current = false;
    if (!enabled || !scanId) {
      setConnection("idle");
      setUseFallbackPolling(false);
      return;
    }

    setConnection("connecting");
    setStreamError(null);
    setUseFallbackPolling(false);
    setStatusSnapshot(null);
    setLastEvent(null);
    setProgress(null);

    const url = `/api/realtime/scan-stream?scanId=${encodeURIComponent(scanId)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setConnection("open");
      setUseFallbackPolling(false);
    };

    es.onmessage = (e) => {
      let data: unknown;
      try {
        data = JSON.parse(e.data as string);
      } catch {
        return;
      }
      const d = data as { type?: string } & Record<string, unknown>;
      if (d.type === "scan" && typeof d.event === "string") {
        const ev = d as ScanStreamScanEvent;
        setLastEvent(ev);
        onStreamEventRef.current?.(ev);
        const p = typeof ev.progress === "number" ? ev.progress : null;
        if (p != null) {
          setProgress(p);
        }
        if (ev.event === "scan_completed" || ev.event === "risk_calculated") {
          void (async () => {
            const snap = await fetchScanStatus(scanId);
            if (snap) {
              setStatusSnapshot(snap);
            }
          })();
        }
        if (ev.event === "scan_completed" && !completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current?.({ scanId, lastEvent: ev });
        }
      }
    };

    es.onerror = () => {
      setConnection("error");
      setStreamError("stream_error");
      es.close();
      setUseFallbackPolling(true);
    };

    return () => {
      es.close();
      esRef.current = null;
      clearPollers();
      setConnection("closed");
    };
  }, [enabled, scanId, clearPollers]);

  /** Poll status every ~2.5s (with or without SSE). */
  useEffect(() => {
    if (!enabled || !scanId) {
      return;
    }
    if (useFallbackPolling) {
      clearPollers();
      fallbackRef.current = setInterval(() => {
        void (async () => {
          const snap = await fetchScanStatus(scanId);
          if (!snap) {
            return;
          }
          setStatusSnapshot(snap);
          if (snap.jobStatus === "failed") {
            setStreamError(snap.lastError || "scan_failed");
            if (fallbackRef.current) {
              clearInterval(fallbackRef.current);
            }
            return;
          }
          if (snap.jobStatus === "completed" && snap.discovery && snap.risk && !completedRef.current) {
            completedRef.current = true;
            onCompleteRef.current?.({ scanId });
            if (fallbackRef.current) {
              clearInterval(fallbackRef.current);
            }
          }
        })();
      }, 2500);
      return () => {
        if (fallbackRef.current) {
          clearInterval(fallbackRef.current);
        }
      };
    }
    clearPollers();
    pollRef.current = setInterval(() => {
      void (async () => {
        const snap = await fetchScanStatus(scanId);
        if (!snap) {
          return;
        }
        setStatusSnapshot(snap);
        if (snap.jobStatus === "failed") {
          setStreamError(snap.lastError || "scan_failed");
          if (pollRef.current) {
            clearInterval(pollRef.current);
          }
          return;
        }
        if (
          (snap.status === "completed" || snap.jobStatus === "completed") &&
          snap.discovery &&
          snap.risk &&
          !completedRef.current
        ) {
          completedRef.current = true;
          onCompleteRef.current?.({ scanId });
          if (pollRef.current) {
            clearInterval(pollRef.current);
          }
        }
      })();
    }, 2500);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [enabled, scanId, useFallbackPolling, clearPollers]);

  return {
    connection,
    lastEvent,
    progress,
    streamError,
    useFallbackPolling,
    statusSnapshot
  };
}
