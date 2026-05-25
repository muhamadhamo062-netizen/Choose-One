/**
 * Secures `GET/POST` internal job routes. Set `CRON_SECRET` in production
 * and send `Authorization: Bearer <CRON_SECRET>`. In local dev, set
 * `PE_ALLOW_INSECURE_INTERNAL=1` to allow unauthenticated access (or use a secret).
 */
export function isInternalRouteAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET || process.env.INTERNAL_QUEUE_SECRET;
  if (!expected) {
    return process.env.NODE_ENV === "development" && process.env.PE_ALLOW_INSECURE_INTERNAL === "1";
  }
  const h = request.headers.get("authorization") || "";
  return h === `Bearer ${expected}`;
}
