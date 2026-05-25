import { prisma } from "@/lib/prisma";
import { safeDbResult } from "@/lib/safe-db";
import puppeteer from "puppeteer";
import { maybeGenerateAndSendCaseReport } from "@/lib/case-report";
import { sendCaseReportReadyEmail } from "@/lib/email";

type BrokerName = "Whitepages" | "Spokeo" | "MyLife" | "Radaris" | "Intelius";

type BrokerTarget = {
  name: BrokerName;
  toEmail: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getAdminEmail(): string {
  return (process.env.ADMIN_EMAILS?.split(",")[0] ?? "muhamadhamo062@gmail.com").trim();
}

function getResendEnv(): { key: string; from: string } | null {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!key || !from) return null;
  return { key, from };
}

function brokerTargets(): BrokerTarget[] {
  // Prefer explicit env overrides; otherwise fall back to BROKER_OPTOUT_FALLBACK_EMAIL; otherwise skip.
  const fallback = process.env.BROKER_OPTOUT_FALLBACK_EMAIL?.trim() || null;
  const mylife = process.env.MYLIFE_OPTOUT_EMAIL?.trim() || "privacy@mylife.com";
  return [
    { name: "Whitepages", toEmail: process.env.WHITEPAGES_OPTOUT_EMAIL?.trim() || fallback },
    { name: "Spokeo", toEmail: process.env.SPOKEO_OPTOUT_EMAIL?.trim() || fallback },
    { name: "MyLife", toEmail: mylife || fallback },
    { name: "Radaris", toEmail: process.env.RADARIS_OPTOUT_EMAIL?.trim() || fallback },
    { name: "Intelius", toEmail: process.env.INTELIUS_OPTOUT_EMAIL?.trim() || fallback }
  ];
}

function buildTakedownEmail(input: {
  broker: BrokerName;
  subjectName: string;
  subjectEmail: string;
  stateCode?: string | null;
  evidenceId: string;
}): { subject: string; text: string; html: string } {
  const subject = `Privacy Takedown Request (CCPA/CPRA) - ${input.subjectEmail}`;
  const text = `To ${input.broker} Privacy Team,

This is a formal Privacy Takedown request to delete and suppress personal data records associated with:
- Name: ${input.subjectName}
- Email: ${input.subjectEmail}
- State: ${input.stateCode ?? "N/A"}

We request that you:
1) Remove the individual’s record(s) from public search results and APIs you operate.
2) Suppress the record to prevent re-publication.
3) Confirm completion by reply email.

Evidence PDF ID: ${input.evidenceId}

Regards,
PrivacyEraser Automated Removal Agent`;

  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
  <h2 style="margin:0 0 10px">Privacy Takedown Request (CCPA/CPRA)</h2>
  <p style="margin:0 0 10px">To <strong>${input.broker}</strong> Privacy Team,</p>
  <p style="margin:0 0 10px">This is a formal request to delete and suppress personal data records associated with:</p>
  <ul style="margin:0 0 12px;padding-left:18px">
    <li><strong>Name:</strong> ${input.subjectName}</li>
    <li><strong>Email:</strong> ${input.subjectEmail}</li>
    <li><strong>State:</strong> ${input.stateCode ?? "N/A"}</li>
  </ul>
  <p style="margin:0 0 10px">Please remove the individual’s record(s) from public search results and suppress the record to prevent re-publication.</p>
  <p style="margin:0 0 10px"><strong>Evidence PDF ID:</strong> ${input.evidenceId}</p>
  <p style="margin:0">Regards,<br/>PrivacyEraser Automated Removal Agent</p>
</div>`;

  return { subject, text, html };
}

async function generateEvidencePdf(input: {
  broker: BrokerName;
  subjectName: string;
  subjectEmail: string;
  stateCode?: string | null;
  evidenceId: string;
}): Promise<Buffer> {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Privacy Takedown Evidence</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; }
      .k { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #475569; }
      .h { font-size: 22px; font-weight: 800; margin: 10px 0 18px; }
      .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
      .row { display: flex; gap: 18px; margin-top: 10px; }
      .label { width: 160px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
      .value { flex: 1; font-weight: 700; }
      .muted { color: #334155; font-size: 12px; margin-top: 14px; }
      .stamp { margin-top: 22px; font-size: 12px; color: #475569; }
    </style>
  </head>
  <body>
    <div class="k">PrivacyEraser Evidence Packet</div>
    <div class="h">Privacy Takedown Evidence</div>
    <div class="card">
      <div class="row"><div class="label">Evidence ID</div><div class="value">${input.evidenceId}</div></div>
      <div class="row"><div class="label">Broker</div><div class="value">${input.broker}</div></div>
      <div class="row"><div class="label">Subject name</div><div class="value">${input.subjectName}</div></div>
      <div class="row"><div class="label">Subject email</div><div class="value">${input.subjectEmail}</div></div>
      <div class="row"><div class="label">State</div><div class="value">${input.stateCode ?? "N/A"}</div></div>
      <div class="muted">
        This document is generated to evidence that an opt-out/deletion request was initiated for the subject.
        It is not a legal opinion. Brokers may request additional verification.
      </div>
      <div class="stamp">Generated at: ${new Date().toISOString()}</div>
    </div>
  </body>
</html>`;

  const browser = await puppeteer.launch({ headless: "new" });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buf = await page.pdf({ format: "A4", printBackground: true });
    return Buffer.from(buf);
  } finally {
    await browser.close();
  }
}

async function sendResendEmailWithAttachment(input: {
  to: string;
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
  attachment: { filename: string; content: Buffer };
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const env = getResendEnv();
  if (!env) return { ok: false, error: "missing_resend_env" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.from,
      to: [normalizeEmail(input.to)],
      cc: (input.cc ?? []).map(normalizeEmail),
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: [
        {
          filename: input.attachment.filename,
          content: input.attachment.content.toString("base64")
        }
      ]
    })
  });

  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) {
    return { ok: false, error: body.message ?? `resend_${res.status}` };
  }
  return { ok: true, id: typeof body.id === "string" ? body.id : undefined };
}

export async function nukeUserByEmail(input: {
  userEmail: string;
  userFullName?: string | null;
  stateCode?: string | null;
  scanId?: string | null;
}): Promise<{ ok: boolean; attempted: number; sent: number }> {
  const userEmail = normalizeEmail(input.userEmail);
  if (!userEmail || !userEmail.includes("@")) return { ok: false, attempted: 0, sent: 0 };

  const admin = getAdminEmail();
  const subjectName = (input.userFullName?.trim() || userEmail.split("@")[0] || "User").trim();
  const stateCode = input.stateCode ?? null;

  const userRes = await safeDbResult(() =>
    prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true }
    })
  );
  const userId = userRes.ok && userRes.value ? userRes.value.id : null;

  const targets = brokerTargets();
  let attempted = 0;
  let sent = 0;

  for (const broker of targets) {
    if (!broker.toEmail) continue;
    attempted += 1;
    const evidenceId = `EV-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

    if (userId) {
      // Update the most recent active job (pending/sent) or create a new one.
      void safeDbResult(async () => {
        const existing = await prisma.removalJob.findFirst({
          where: { userId, brokerName: broker.name, status: { in: ["pending", "sent"] } },
          orderBy: { createdAt: "desc" },
          select: { id: true }
        });
        if (existing?.id) {
          await prisma.removalJob.update({
            where: { id: existing.id },
            data: {
              status: "pending",
              scanId: input.scanId ?? null,
              requestChannel: "email",
              requestTarget: broker.toEmail,
              payload: { subjectName, email: userEmail, stateCode, evidenceId },
              lastError: null
            }
          });
          return;
        }
        await prisma.removalJob.create({
          data: {
            userId,
            scanId: input.scanId ?? null,
            brokerName: broker.name,
            status: "pending",
            requestChannel: "email",
            requestTarget: broker.toEmail,
            payload: { subjectName, email: userEmail, stateCode, evidenceId }
          }
        });
      });
    }

    const pdf = await generateEvidencePdf({
      broker: broker.name,
      subjectName,
      subjectEmail: userEmail,
      stateCode,
      evidenceId
    });
    const mail = buildTakedownEmail({
      broker: broker.name,
      subjectName,
      subjectEmail: userEmail,
      stateCode,
      evidenceId
    });

    const sendRes = await sendResendEmailWithAttachment({
      to: broker.toEmail,
      cc: [admin],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachment: { filename: `privacy-takedown-evidence-${broker.name.toLowerCase()}.pdf`, content: pdf }
    });

    if (userId) {
      void safeDbResult(async () => {
        const existing = await prisma.removalJob.findFirst({
          where: { userId, brokerName: broker.name, status: { in: ["pending", "sent"] } },
          orderBy: { createdAt: "desc" },
          select: { id: true }
        });
        if (existing?.id) {
          await prisma.removalJob.update({
            where: { id: existing.id },
            data: {
              status: sendRes.ok ? "sent" : "failed",
              requestedAt: sendRes.ok ? new Date() : null,
              externalRequestId: sendRes.id ?? null,
              lastError: sendRes.ok ? null : sendRes.error ?? "resend_failed",
              attemptCount: { increment: 1 },
              requestTarget: broker.toEmail
            }
          });
          return;
        }
        await prisma.removalJob.create({
          data: {
            userId,
            scanId: input.scanId ?? null,
            brokerName: broker.name,
            status: sendRes.ok ? "sent" : "failed",
            requestChannel: "email",
            requestTarget: broker.toEmail,
            externalRequestId: sendRes.id ?? null,
            requestedAt: sendRes.ok ? new Date() : null,
            attemptCount: 1,
            lastError: sendRes.ok ? null : sendRes.error ?? "resend_failed",
            payload: { subjectName, email: userEmail, stateCode, evidenceId }
          }
        });
      });
    }

    await safeDbResult(() =>
      prisma.event.create({
        data: {
          userId,
          event: "nuke_removal_request",
          properties: {
            broker: broker.name,
            to: broker.toEmail,
            cc: admin,
            subjectEmail: userEmail,
            evidenceId,
            resendOk: sendRes.ok,
            resendId: sendRes.id ?? null,
            error: sendRes.error ?? null,
            scanId: input.scanId ?? null
          }
        }
      })
    );

    if (sendRes.ok) {
      sent += 1;
    }
  }

  // If all 5 brokers were successfully sent, generate and store Case Report + email link.
  if (userId && sent >= 5) {
    try {
      const rep = await maybeGenerateAndSendCaseReport({
        userId,
        userEmail,
        scanId: input.scanId ?? null
      });
      if (rep.ok && rep.url) {
        void sendCaseReportReadyEmail({ to: userEmail, url: rep.url });
      }
    } catch {
      // best-effort
    }
  }

  return { ok: true, attempted, sent };
}

