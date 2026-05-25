import { NextResponse } from "next/server";
import { getSessionUserIdFromCookies } from "@/lib/auth-cookies";
import { trackAnalyticsEvent } from "@/lib/analytics/analytics-events";
import { emitServerEvent } from "@/lib/events/event-emitter";

const MAX_EVENT_NAME = 200;

/**
 * Intake: enqueues client-forwarded or edge events for async persist into `events`.
 * Always returns 200 for valid JSON + event name (optimistic) — no user-facing 503/DB errors.
 */
export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      const raw = await request.json();
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
      }
      body = raw as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    let safePayload: Record<string, unknown>;
    try {
      safePayload = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const rawName =
      typeof body.event === "string"
        ? body.event
        : typeof (body as { name?: string }).name === "string"
          ? (body as { name: string }).name
          : "client_event";
    const name = rawName.slice(0, MAX_EVENT_NAME);
    if (name.length === 0) {
      return NextResponse.json({ ok: false, error: "invalid_event_name" }, { status: 400 });
    }

    let userId: string | null = null;
    try {
      userId = (await getSessionUserIdFromCookies()) ?? null;
    } catch {
      userId = null;
    }

    const id = await emitServerEvent({
      event: name,
      userId: userId ?? null,
      payload: safePayload
    });

    if (name === "removal_started") {
      const scanId = typeof safePayload.scanId === "string" ? safePayload.scanId : "";
      void trackAnalyticsEvent({
        type: "removal_requested",
        userId: userId ?? null,
        scanId: scanId || null,
        metadata: safePayload
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[api/events removal_started analytics]", err);
      });
    }

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.info("[PE Events API]", { ts: new Date().toISOString(), event: name, status: "queued" });
    }
    return NextResponse.json({ ok: true, status: "queued", id });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[api/events]", e);
    // Still avoid surfacing 5xx for intake; client may retry.
    return NextResponse.json({ ok: true, status: "queued" }, { status: 200 });
  }
}
