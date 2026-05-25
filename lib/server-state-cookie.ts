import { COOKIE_MAX_AGE_SEC, COOKIE_STATE, type ServerStateSnapshot } from "@/lib/server-state-types";
import type { PeScanData as Pe } from "@/types/funnel";

const SCAN_COOKIE = "pe_scan_echo";

function encode(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

function decode(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

export function parseStateCookie(raw: string | undefined): ServerStateSnapshot | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(decode(raw)) as ServerStateSnapshot;
  } catch {
    return null;
  }
}

export function serializeStateCookie(snapshot: ServerStateSnapshot): string {
  return encode(JSON.stringify(snapshot));
}

export function parseScanCookie(raw: string | undefined): Pe | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(decode(raw)) as Pe;
  } catch {
    return null;
  }
}

export function maybeSerializeScanForCookie(scan: Pe | null): string | null {
  if (!scan) {
    return null;
  }
  const s = JSON.stringify(scan);
  if (s.length > 3800) {
    return null;
  }
  return encode(s);
}

export { COOKIE_STATE, COOKIE_MAX_AGE_SEC, SCAN_COOKIE };
