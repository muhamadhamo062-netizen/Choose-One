function isRetryableFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const msg = error.message.toLowerCase();
  const code = (error as NodeJS.ErrnoException).code?.toLowerCase() ?? "";
  return (
    error.name === "AbortError" ||
    code === "econnreset" ||
    code === "etimedout" ||
    code === "econnrefused" ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("socket")
  );
}

export type FetchWithRetryInit = RequestInit & { timeoutMs?: number };

/**
 * One immediate retry on transient network failures (connection reset, timeout, etc.).
 */
export async function fetchWithOneRetry(input: RequestInfo | URL, init?: FetchWithRetryInit): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? 15_000;
  const run = async (): Promise<Response> => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const { timeoutMs: _t, ...rest } = init ?? {};
      return await fetch(input, { ...rest, signal: ac.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await run();
  } catch (error) {
    if (!isRetryableFetchError(error)) {
      throw error;
    }
    return run();
  }
}
