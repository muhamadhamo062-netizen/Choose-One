import { prisma } from "@/lib/prisma";
import { safeDbResult } from "@/lib/safe-db";
import { sendRemovalRequestSentEmail } from "@/lib/email";
import { runDeletionVerification } from "@/lib/verification/verification-engine";

type BrokerAdapter = {
  name: string;
  channel: "api" | "email";
  endpoint?: string;
  supportEmail?: string;
};

const VERIFY_INTERVAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const BROKER_ADAPTERS: BrokerAdapter[] = [
  {
    name: "Whitepages",
    channel: "api",
    endpoint: process.env.WHITEPAGES_OPTOUT_API_URL?.trim()
  },
  {
    name: "Spokeo",
    channel: "api",
    endpoint: process.env.SPOKEO_OPTOUT_API_URL?.trim()
  },
  {
    name: "MyLife",
    channel: "email",
    supportEmail: process.env.MYLIFE_OPTOUT_EMAIL?.trim() || "privacy@mylife.com"
  }
];

function verifyAtDate(from = new Date()): Date {
  return new Date(from.getTime() + VERIFY_INTERVAL_DAYS * DAY_MS);
}

function hasMeaningfulEndpoint(url: string | undefined): boolean {
  return Boolean(url && /^https?:\/\//.test(url));
}

async function sendOptOutEmail(input: {
  to: string;
  subjectName: string;
  subjectEmail: string;
  stateCode?: string | null;
  brokerName: string;
}): Promise<{ ok: boolean; providerId?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!key || !from) {
    return { ok: false, error: "missing_resend_env" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: `CCPA/GDPR Deletion Request - ${input.subjectEmail}`,
        text: `To ${input.brokerName} Privacy Team,

This is a formal request to delete and suppress personal data records associated with:
- Name: ${input.subjectName}
- Email: ${input.subjectEmail}
- State: ${input.stateCode ?? "N/A"}

Please process this deletion/opt-out request in accordance with applicable privacy laws (including CCPA/CPRA and GDPR where applicable).
Please confirm completion by reply email.

Regards,
PrivacyEraser Automated Removal Agent`
      })
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      return { ok: false, error: body.message ?? `resend_${res.status}` };
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, providerId: body.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "email_send_failed" };
  }
}

async function sendApiOptOut(input: {
  endpoint: string;
  brokerName: string;
  fullName: string;
  email: string;
  stateCode?: string | null;
}): Promise<{ ok: boolean; externalRequestId?: string; error?: string }> {
  try {
    const res = await fetch(input.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: input.fullName,
        email: input.email,
        stateCode: input.stateCode ?? null,
        source: "privacyeraser"
      }),
      cache: "no-store"
    });
    const body = (await res.json().catch(() => ({}))) as { requestId?: string; id?: string; error?: string };
    if (!res.ok) {
      return { ok: false, error: body.error ?? `api_${res.status}` };
    }
    return { ok: true, externalRequestId: body.requestId ?? body.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "api_send_failed" };
  }
}

export async function enqueueRemovalJobsForUser(input: {
  userId: string;
  scanId?: string | null;
}): Promise<{ created: number }> {
  const userRes = await safeDbResult(() =>
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, email: true, fullName: true }
    })
  );
  if (!userRes.ok || !userRes.value) {
    return { created: 0 };
  }
  const user = userRes.value;

  const scanRes = await safeDbResult(() =>
    prisma.scan.findFirst({
      where: input.scanId ? { publicScanId: input.scanId } : { userId: input.userId },
      orderBy: { createdAt: "desc" },
      select: { publicScanId: true, state: true, discoveryJson: true }
    })
  );
  const scan = scanRes.ok ? scanRes.value : null;
  const sources = (
    scan?.discoveryJson &&
    typeof scan.discoveryJson === "object" &&
    Array.isArray((scan.discoveryJson as { brokerSources?: unknown[] }).brokerSources)
      ? ((scan.discoveryJson as { brokerSources?: unknown[] }).brokerSources ?? []).filter(
          (v): v is string => typeof v === "string"
        )
      : []
  ).map((s) => s.trim());

  const targetBrokers = BROKER_ADAPTERS.filter(
    (adapter) => sources.length === 0 || sources.some((s) => s.toLowerCase().includes(adapter.name.toLowerCase()))
  );

  let created = 0;
  for (const adapter of targetBrokers) {
    const existingRes = await safeDbResult(() =>
      prisma.removalJob.findFirst({
        where: {
          userId: input.userId,
          brokerName: adapter.name,
          status: { in: ["pending", "sent"] }
        }
      })
    );
    if (!existingRes.ok) {
      continue;
    }
    if (existingRes.value) {
      continue;
    }
    const rowRes = await safeDbResult(() =>
      prisma.removalJob.create({
        data: {
          userId: input.userId,
          scanId: scan?.publicScanId ?? null,
          brokerName: adapter.name,
          status: "pending",
          requestChannel: adapter.channel,
          requestTarget: adapter.channel === "api" ? adapter.endpoint ?? null : adapter.supportEmail ?? null,
          payload: {
            fullName: user.fullName ?? user.email.split("@")[0],
            email: user.email,
            stateCode: scan?.state ?? null
          },
          nextVerificationAt: verifyAtDate()
        }
      })
    );
    if (rowRes.ok) {
      created += 1;
    }
  }
  return { created };
}

export async function executePendingRemovalJobs(limit = 25): Promise<{ processed: number; sent: number; failed: number }> {
  const jobsRes = await safeDbResult(() =>
    prisma.removalJob.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: Math.max(1, Math.min(100, limit)),
      include: { user: true }
    })
  );
  if (!jobsRes.ok) {
    return { processed: 0, sent: 0, failed: 0 };
  }
  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const job of jobsRes.value) {
    processed += 1;
    const payload = (job.payload ?? {}) as { fullName?: string; email?: string; stateCode?: string };
    const fullName = payload.fullName || job.user.fullName || job.user.email.split("@")[0];
    const email = payload.email || job.user.email;
    const stateCode = payload.stateCode ?? null;
    const adapter = BROKER_ADAPTERS.find((x) => x.name === job.brokerName);

    let outcome: { ok: boolean; externalRequestId?: string; error?: string } = { ok: false, error: "adapter_not_found" };
    if (adapter?.channel === "api" && hasMeaningfulEndpoint(adapter.endpoint)) {
      outcome = await sendApiOptOut({
        endpoint: adapter.endpoint!,
        brokerName: adapter.name,
        fullName,
        email,
        stateCode
      });
    } else if (adapter?.channel === "email" && adapter.supportEmail) {
      outcome = await sendOptOutEmail({
        to: adapter.supportEmail,
        subjectName: fullName,
        subjectEmail: email,
        stateCode,
        brokerName: adapter.name
      });
    } else if (adapter?.channel === "api" && !hasMeaningfulEndpoint(adapter.endpoint)) {
      // Fallback for API brokers without configured endpoint: use privacy inbox escalation.
      const fallbackTo = process.env.BROKER_OPTOUT_FALLBACK_EMAIL?.trim();
      outcome = fallbackTo
        ? await sendOptOutEmail({
            to: fallbackTo,
            subjectName: fullName,
            subjectEmail: email,
            stateCode,
            brokerName: adapter.name
          })
        : { ok: false, error: "missing_api_endpoint_and_fallback" };
    }

    if (outcome.ok) {
      sent += 1;
      await safeDbResult(() =>
        prisma.removalJob.update({
          where: { id: job.id },
          data: {
            status: "sent",
            requestedAt: new Date(),
            nextVerificationAt: verifyAtDate(),
            lastError: null,
            attemptCount: { increment: 1 },
            externalRequestId: outcome.externalRequestId ?? null
          }
        })
      );
      void sendRemovalRequestSentEmail({
        to: job.user.email,
        brokerName: job.brokerName
      });
      continue;
    }

    failed += 1;
    await safeDbResult(() =>
      prisma.removalJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          lastError: outcome.error ?? "unknown_removal_error",
          attemptCount: { increment: 1 }
        }
      })
    );
  }

  return { processed, sent, failed };
}

export async function verifyDueRemovalJobs(limit = 25): Promise<{ checked: number; verified: number; stillPresent: number }> {
  const now = new Date();
  const jobsRes = await safeDbResult(() =>
    prisma.removalJob.findMany({
      where: {
        status: "sent",
        nextVerificationAt: { lte: now }
      },
      include: {
        user: true,
        scan: true
      },
      orderBy: { nextVerificationAt: "asc" },
      take: Math.max(1, Math.min(100, limit))
    })
  );
  if (!jobsRes.ok) {
    return { checked: 0, verified: 0, stillPresent: 0 };
  }

  let checked = 0;
  let verified = 0;
  let stillPresent = 0;
  for (const job of jobsRes.value) {
    checked += 1;
    const stateCode = job.scan?.state ?? "";
    const stateLabel = stateCode;
    const summary = await runDeletionVerification({
      requestId: job.scanId ?? job.id,
      userId: job.userId,
      subject: {
        fullName: job.user.fullName ?? undefined,
        email: job.user.email,
        stateCode,
        stateLabel
      },
      sources: [job.brokerName]
    });
    const isVerified = summary.status === "verified_deleted";
    if (isVerified) {
      verified += 1;
      await safeDbResult(() =>
        prisma.removalJob.update({
          where: { id: job.id },
          data: {
            status: "verified",
            verifiedAt: new Date(),
            nextVerificationAt: null,
            lastError: null
          }
        })
      );
    } else {
      stillPresent += 1;
      await safeDbResult(() =>
        prisma.removalJob.update({
          where: { id: job.id },
          data: {
            status: "sent",
            nextVerificationAt: verifyAtDate(),
            lastError: summary.status
          }
        })
      );
    }
  }
  return { checked, verified, stillPresent };
}
