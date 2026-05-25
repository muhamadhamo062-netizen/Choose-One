import { NextResponse } from "next/server";

/** 401 — auth only (invalid / missing session / bad token). */
export function jsonUnauthorized(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "unauthorized", reason: "invalid_or_missing_session" },
    { status: 401 }
  );
}

/** 503 — infrastructure / DB / server config (never conflate with 401). */
export function jsonServiceUnavailable(reason: string): NextResponse {
  return NextResponse.json({ error: "service_unavailable", reason }, { status: 503 });
}

/** 503 — write path blocked (e.g. global write fence) while system is busy. */
export function jsonSystemBusy(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "system_busy", message: "System is busy. Try again shortly." },
    { status: 503 }
  );
}

/** Soft infrastructure / DB failure — no 5xx for user-facing flows. */
export function jsonServiceDegraded(reason: string): NextResponse {
  return NextResponse.json(
    { ok: false, error: "service_unavailable", reason, message: "Please try again in a moment." },
    { status: 200 }
  );
}
