import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, getUserFromSession } from "@/lib/auth-session";
import { enforceRateLimit } from "@/lib/scan-rate-limit";
import { maskPasswordForDisplay } from "@/lib/deep-scan-masking";
import type { LeakRecord } from "@/services/leakProvider";
import {
  getManualDeepScanQuota,
  isActiveLifetimeSubscription,
  MANUAL_DEEP_SCAN_MONTHLY_LIMIT,
  recordDeepScanUsage
} from "@/lib/lifetime-scan-quota";
import { dehashedCredentialsConfigured, fetchDeHashedBreaches } from "@/services/dehashedScan";
import { fetchIntelxIdentitySignals, intelxCredentialsConfigured } from "@/services/intelxScan";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

type DeepScanBreachOut = {
  source: string;
  password: string | null;
  passwordHint: string | null;
  ipAddress: string | null;
  removeUrl: string | null;
  breachDate: string | null;
};

type DeepScanIdentityOut = {
  addresses: Array<{ city: string; state: string; streetMasked: string }>;
  phones: string[];
  photoUrl: string | null;
  brokers: Array<{ name: string; status: "EXPOSED" | "NO_SIGNAL" }>;
  darkWebHits: Array<{ title: string; bucket: string; date: string | null; preview: string }>;
};

function computeRiskScore(breachCount: number, exposedPasswordCount: number, darkWebHits: number): number {
  return Math.min(100, breachCount * 12 + exposedPasswordCount * 18 + darkWebHits * 6);
}

function riskLevelFromScore(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 85) {
    return "CRITICAL";
  }
  if (score >= 60) {
    return "HIGH";
  }
  if (score >= 30) {
    return "MEDIUM";
  }
  return "LOW";
}

function getRequestIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  const real = request.headers.get("x-real-ip")?.trim();
  return real || null;
}

const GEO_LOOKUP_BUDGET_MS = 900;

async function resolveGeoByIp(ip: string): Promise<{
  latitude: number;
  longitude: number;
  leaksWithIp: number;
  city: string | null;
  country: string | null;
} | null> {
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,lat,lon,city,country`, {
      method: "GET",
      cache: "no-store"
    });
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as {
      status?: string;
      lat?: number;
      lon?: number;
      city?: string;
      country?: string;
    };
    if (json.status !== "success" || typeof json.lat !== "number" || typeof json.lon !== "number") {
      return null;
    }
    return {
      latitude: json.lat,
      longitude: json.lon,
      leaksWithIp: 1,
      city: typeof json.city === "string" ? json.city : null,
      country: typeof json.country === "string" ? json.country : null
    };
  } catch {
    return null;
  }
}

function formatBreach(record: LeakRecord, maskSensitive: boolean): DeepScanBreachOut {
  const rawPassword = record.password?.trim() || null;
  return {
    source: record.source,
    password: maskSensitive ? null : rawPassword,
    passwordHint: rawPassword ? (maskSensitive ? maskPasswordForDisplay(rawPassword) : rawPassword) : null,
    ipAddress: record.ipAddress,
    removeUrl: record.removeUrl,
    breachDate: record.breachDate
  };
}

function dedupeBreaches(records: LeakRecord[]): LeakRecord[] {
  const seen = new Set<string>();
  const out: LeakRecord[] = [];
  for (const row of records) {
    const key = `${row.source}|${row.password ?? ""}|${row.email ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(row);
  }
  return out;
}

function buildIdentity(
  intelx: Awaited<ReturnType<typeof fetchIntelxIdentitySignals>> | null,
  breachSources: string[]
): DeepScanIdentityOut | null {
  if (!intelx && breachSources.length === 0) {
    return null;
  }

  const darkWebExposed = Boolean(intelx?.darkWebHits.length);
  const brokers: DeepScanIdentityOut["brokers"] = [
    { name: "Dark Web Index", status: darkWebExposed ? "EXPOSED" : "NO_SIGNAL" },
    { name: "IntelX Corpus", status: intelx?.sources.length ? "EXPOSED" : "NO_SIGNAL" }
  ];

  for (const source of breachSources.slice(0, 4)) {
    brokers.push({ name: source, status: "EXPOSED" });
  }

  return {
    addresses: intelx?.addresses ?? [],
    phones: intelx?.phones ?? [],
    photoUrl: null,
    brokers: brokers.slice(0, 8),
    darkWebHits: intelx?.darkWebHits ?? []
  };
}

function providerLabel(): string {
  const parts: string[] = [];
  if (dehashedCredentialsConfigured()) {
    parts.push("dehashed");
  }
  if (intelxCredentialsConfigured()) {
    parts.push("intelx");
  }
  return parts.length ? parts.join("+") : "unconfigured";
}

export async function POST(request: Request) {
  try {
    const rate = await enforceRateLimit(request, {
      keyPrefix: "rate:deep-scan",
      limit: 10,
      windowSeconds: 60 * 60
    });
    if (!rate.ok) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const session = await getSession();
    const authedUser =
      session.kind === "authed" ? await getUserFromSession(session.userId) : { user: null as null, dbError: false };
    const entitlement =
      authedUser.user
        ? await prisma.subscription.findFirst({
            where: { userId: authedUser.user.id },
            orderBy: { startedAt: "desc" }
          })
        : null;
    const isPaidTier = isActiveLifetimeSubscription(entitlement);
    const maskSensitive = !isPaidTier;
    const lifetimeUserId = authedUser.user?.id ?? null;

    const body = (await request.json().catch(() => null)) as
      | { email?: string; stateCode?: string; fullName?: string }
      | null;
    const stateCode = typeof body?.stateCode === "string" ? body.stateCode.trim().toUpperCase() : "";
    const fullNameFromBody = typeof body?.fullName === "string" ? body.fullName.trim() : "";
    const fullName = fullNameFromBody || authedUser.user?.fullName || "";
    const requestedEmail =
      typeof body?.email === "string" && body.email.trim() ? body.email.trim() : (authedUser.user?.email ?? "");

    if (!requestedEmail || !requestedEmail.includes("@")) {
      return NextResponse.json(
        { error: "email_required", message: "Email is required to perform a deep security audit." },
        { status: 400 }
      );
    }

    const normalizedEmail = requestedEmail.trim().toLowerCase();

    let scansRemaining: { used: number; limit: number; remaining: number; cycleStart: string } | undefined;
    if (isPaidTier && lifetimeUserId && entitlement) {
      const quota = await getManualDeepScanQuota(lifetimeUserId, entitlement.startedAt);
      scansRemaining = quota;
      if (quota.used >= MANUAL_DEEP_SCAN_MONTHLY_LIMIT) {
        return NextResponse.json(
          {
            ok: false,
            error: "manual_scan_limit_reached",
            message: `You have used all ${MANUAL_DEEP_SCAN_MONTHLY_LIMIT} manual deep scans for this billing cycle.`,
            scansRemaining: quota
          },
          { status: 423 }
        );
      }
    }

    const providerErrors: string[] = [];

    const [dehashedSettled, intelxSettled] = await Promise.allSettled([
      dehashedCredentialsConfigured()
        ? fetchDeHashedBreaches(normalizedEmail)
        : Promise.reject(new Error("dehashed_not_configured")),
      intelxCredentialsConfigured()
        ? fetchIntelxIdentitySignals(normalizedEmail, stateCode, maskSensitive)
        : Promise.reject(new Error("intelx_not_configured"))
    ]);

    let leakRecords: LeakRecord[] = [];
    if (dehashedSettled.status === "fulfilled") {
      leakRecords = dehashedSettled.value.breaches;
    } else {
      const reason =
        dehashedSettled.reason instanceof Error ? dehashedSettled.reason.message : "dehashed_failed";
      providerErrors.push(reason);
    }

    let intelxSignals: Awaited<ReturnType<typeof fetchIntelxIdentitySignals>> | null = null;
    if (intelxSettled.status === "fulfilled") {
      intelxSignals = intelxSettled.value;
    } else {
      const reason = intelxSettled.reason instanceof Error ? intelxSettled.reason.message : "intelx_failed";
      providerErrors.push(reason);
    }

    const deduped = dedupeBreaches(leakRecords);
    const breaches = deduped.map((row) => formatBreach(row, maskSensitive));
    const breachSources = breaches.map((b) => b.source);
    const exposedPasswordCount = deduped.filter((r) => Boolean(r.password?.trim())).length;
    const darkWebCount = intelxSignals?.darkWebHits.length ?? 0;
    const riskScore = computeRiskScore(breaches.length, exposedPasswordCount, darkWebCount);
    const riskLevel = riskLevelFromScore(riskScore);

    const ipFromBreaches = deduped.map((r) => r.ipAddress).find((ip) => typeof ip === "string" && ip.trim()) ?? null;
    const requestIp = getRequestIp(request);
    const geoIp = ipFromBreaches ?? requestIp;
    const map = geoIp
      ? await Promise.race([
          resolveGeoByIp(geoIp),
          new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), GEO_LOOKUP_BUDGET_MS);
          })
        ])
      : null;

    const identity = buildIdentity(intelxSignals, breachSources);
    const publicScanId = crypto.randomUUID();

    await prisma.scan
      .create({
        data: {
          publicScanId,
          userId: authedUser.user?.id ?? null,
          exposureScore: riskScore,
          brokersFound: identity?.brokers.filter((b) => b.status === "EXPOSED").length ?? breaches.length,
          state: stateCode || "NA",
          riskLevel,
          fullName: fullName || null,
          email: normalizedEmail,
          discoveryJson: {
            provider: providerLabel(),
            breaches: breaches.map((b) => ({
              source: b.source,
              passwordHint: b.passwordHint,
              ipAddress: b.ipAddress
            })),
            identity: identity
              ? {
                  addresses: identity.addresses,
                  phones: identity.phones,
                  darkWebHits: identity.darkWebHits.length
                }
              : null,
            providerErrors: providerErrors.length ? providerErrors : undefined
          }
        }
      })
      .catch(() => {
        // best-effort persistence
      });

    if (isPaidTier && lifetimeUserId && entitlement) {
      await recordDeepScanUsage({
        userId: lifetimeUserId,
        kind: "manual",
        subscriptionStartedAt: entitlement.startedAt,
        publicScanId
      });
      scansRemaining = await getManualDeepScanQuota(lifetimeUserId, entitlement.startedAt);
    }

    const allProvidersMissing =
      !dehashedCredentialsConfigured() && !intelxCredentialsConfigured();
    const noSignals = breaches.length === 0 && !intelxSignals?.phones.length && !intelxSignals?.addresses.length;

    return NextResponse.json({
      ok: true,
      tier: isPaidTier ? "paid" : "free",
      scanId: publicScanId,
      status: "complete",
      provider: providerLabel(),
      message:
        allProvidersMissing
          ? "Breach intelligence API keys are not configured on the server."
          : noSignals
            ? "Scan completed. No live exposures were returned for this email."
            : "Live breach and dark-web intelligence scan completed.",
      risk: { score: riskScore, level: riskLevel },
      breaches,
      map,
      identity,
      scansRemaining,
      meta: {
        dehashedConfigured: dehashedCredentialsConfigured(),
        intelxConfigured: intelxCredentialsConfigured(),
        providerErrors: providerErrors.length ? providerErrors : undefined
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "deep_scan_failed";
    return NextResponse.json(
      {
        ok: false,
        error: "deep_scan_degraded",
        message: "Deep scan could not complete. Please retry shortly.",
        detail: process.env.NODE_ENV === "development" ? message : undefined
      },
      { status: 200 }
    );
  }
}
