import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/lib/auth-cookies";
import { getRawSessionSecret } from "@/lib/auth-secret";
import { verifyPeSessionJwt } from "@/lib/auth-verify";
import { safeDbResult } from "@/lib/safe-db";

export type SessionState =
  | { kind: "authed"; userId: string }
  | { kind: "anonymous" }
  | { kind: "invalid_token" }
  | { kind: "server_misconfigured" };

export async function getSession(): Promise<SessionState> {
  if (!getRawSessionSecret()) {
    return { kind: "server_misconfigured" };
  }
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) {
    return { kind: "anonymous" };
  }
  const v = await verifyPeSessionJwt(token);
  if (!v) {
    return { kind: "invalid_token" };
  }
  return { kind: "authed", userId: v.sub };
}

/** Load Prisma user for the session `userId`. DB down → null with `dbError: true`. */
export async function getUserFromSession(
  userId: string
): Promise<{ user: { id: string; email: string; fullName: string | null } } | { user: null; dbError: boolean }> {
  const r = await safeDbResult(() =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true }
    })
  );
  if (!r.ok) {
    return { user: null, dbError: true };
  }
  if (!r.value) {
    return { user: null, dbError: false };
  }
  return { user: r.value };
}

export class SessionAuthError extends Error {
  readonly code = "invalid_or_missing_session" as const;
  constructor() {
    super("invalid_or_missing_session");
    this.name = "SessionAuthError";
  }
}

export async function validateSessionOrThrow(): Promise<string> {
  const s = await getSession();
  if (s.kind === "server_misconfigured") {
    throw new Error("server_misconfigured");
  }
  if (s.kind !== "authed") {
    throw new SessionAuthError();
  }
  return s.userId;
}
