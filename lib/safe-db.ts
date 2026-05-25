/**
 * Global DB call wrappers: Prisma must never throw through to API handlers.
 */
export type SafeDbResult<T> = { ok: true; value: T } | { ok: false };

/** User-requested pattern: on failure → null, log, never throw. */
export async function safeDbCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("DB ERROR:", e);
    return null;
  }
}

/** Distinguish DB errors from legit null/empty query results. */
export async function safeDbResult<T>(fn: () => Promise<T>): Promise<SafeDbResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("DB ERROR:", e);
    return { ok: false };
  }
}
