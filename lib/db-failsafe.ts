import { Prisma } from "@prisma/client";

type KnownPrismaError = {
  code?: string;
  name?: string;
  message?: string;
};

const PRISMA_TRANSIENT_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

export function isTemporaryDbUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return true;
  }

  const e = error as KnownPrismaError | null;
  if (!e) {
    return false;
  }

  if (typeof e.code === "string" && PRISMA_TRANSIENT_CODES.has(e.code)) {
    return true;
  }

  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  return (
    msg.includes("can't reach database server") ||
    msg.includes("timed out fetching a new connection") ||
    msg.includes("connection terminated") ||
    msg.includes("connection refused")
  );
}
