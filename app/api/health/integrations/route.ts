import { NextResponse } from "next/server";
import { isContactEmailDeliveryConfigured } from "@/lib/contact-delivery";
import { isProductionNodeEnv, isVerifiedPaymentSystemConfigured } from "@/lib/payment-production-guard";
import { logPrismaConnectionError } from "@/lib/logPrismaConnectionError";
import { prisma } from "@/lib/prisma";
import { safeDbResult } from "@/lib/safe-db";
import { getSupabasePrismaEnvErrors } from "@/lib/validateSupabasePrismaEnv";

export const dynamic = "force-dynamic";

type EmailState = "EMAIL_NOT_CONFIGURED" | "ACTIVE";
type PaymentState = "VERIFIED_ACTIVE" | "NOT_ACTIVE";
type QueueState = "CRON_SECRET_REQUIRED" | "CONFIGURED" | "DEV_INSECURE_OK";

type DbHealth =
  | { connected: true; latencyMs: number }
  | { connected: false; error: string; prisma_code?: string };

type SessionHealth =
  | { status: "HS256_configured" }
  | { status: "dev_fallback_only"; note: "SESSION_SECRET <16 or unset; dev uses auth-cookies fallback" }
  | { status: "missing_will_fail_in_production" };

function sessionHealth(): SessionHealth {
  const s = process.env.SESSION_SECRET?.trim() ?? "";
  if (s.length >= 16) {
    return { status: "HS256_configured" };
  }
  if (process.env.NODE_ENV === "development") {
    return { status: "dev_fallback_only", note: "SESSION_SECRET <16 or unset; dev uses auth-cookies fallback" };
  }
  return { status: "missing_will_fail_in_production" };
}

/**
 * Public deployment health for payment, email, and background job wiring (no secrets).
 * Includes a real `SELECT 1` via Prisma (not an env-only DB check).
 */
export async function GET() {
  try {
    const emailState: EmailState = isContactEmailDeliveryConfigured() ? "ACTIVE" : "EMAIL_NOT_CONFIGURED";

    const prod = isProductionNodeEnv();
    const paymentState: PaymentState = isVerifiedPaymentSystemConfigured() ? "VERIFIED_ACTIVE" : "NOT_ACTIVE";

    const hasCron = Boolean(process.env.CRON_SECRET || process.env.INTERNAL_QUEUE_SECRET);
    const queueState: QueueState =
      hasCron
        ? "CONFIGURED"
        : prod
          ? "CRON_SECRET_REQUIRED"
          : "DEV_INSECURE_OK";

    const envErrs = getSupabasePrismaEnvErrors();
    let database: DbHealth;
    if (envErrs.length > 0) {
      database = {
        connected: false,
        error: "invalid_env: " + envErrs.join(" | ")
      };
    } else {
      const t0 = Date.now();
      const ping = await safeDbResult(() => prisma.$queryRaw`SELECT 1`);
      if (ping.ok) {
        database = { connected: true, latencyMs: Date.now() - t0 };
      } else {
        logPrismaConnectionError("health/integrations", new Error("ping_failed"));
        database = {
          connected: false,
          error: "query_failed"
        };
      }
    }

    return NextResponse.json({
      email: { state: emailState },
      payment: { state: paymentState },
      database,
      session: sessionHealth(),
      scanQueue: {
        state: queueState,
        backgroundProcessing: prod && !hasCron ? "DEPLOYMENT_REQUIRED" : "OK"
      }
    });
  } catch (e) {
    console.error("[health/integrations]", e);
    return NextResponse.json(
      {
        email: { state: "EMAIL_NOT_CONFIGURED" as EmailState },
        payment: { state: "NOT_ACTIVE" as PaymentState },
        database: {
          connected: false,
          error: e instanceof Error ? e.message : "health_check_failed"
        },
        session: { status: "missing_will_fail_in_production" as const },
        scanQueue: {
          state: "DEV_INSECURE_OK" as QueueState,
          backgroundProcessing: "OK" as const
        }
      },
      { status: 200 }
    );
  }
}
