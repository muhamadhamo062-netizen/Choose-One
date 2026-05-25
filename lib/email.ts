import { prisma } from "@/lib/prisma";
import { safeDbResult } from "@/lib/safe-db";

export type EmailSendResult = "sent" | "skipped" | "error";

type EmailType = "auth_otp" | "lifetime_welcome" | "monthly_audit" | "integration_test" | "removal_confirmation";

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function logEmailAction(input: {
  type: EmailType;
  recipient: string;
  status: EmailSendResult;
  providerId?: string;
  reason?: string;
}): Promise<void> {
  await safeDbResult(() =>
    prisma.event.create({
      data: {
        event: "email_action",
        properties: {
          type: input.type,
          recipient: input.recipient,
          status: input.status,
          provider: "resend",
          providerId: input.providerId ?? null,
          reason: input.reason ?? null
        }
      }
    })
  );
}

async function sendWithResend(input: {
  type: EmailType;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<EmailSendResult> {
  const normalized = normalizeEmail(input.to);
  if (!normalized) {
    return "skipped";
  }
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!key || !from) {
    await logEmailAction({ type: input.type, recipient: normalized, status: "skipped", reason: "missing_resend_env" });
    return "skipped";
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
        to: [normalized],
        subject: input.subject,
        text: input.text,
        html: input.html
      })
    });

    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    const status: EmailSendResult = res.ok ? "sent" : "error";
    await logEmailAction({
      type: input.type,
      recipient: normalized,
      status,
      providerId: typeof body.id === "string" ? body.id : undefined,
      reason: res.ok ? undefined : body.message ?? `http_${res.status}`
    });
    return status;
  } catch (error) {
    await logEmailAction({
      type: input.type,
      recipient: normalized,
      status: "error",
      reason: error instanceof Error ? error.message : "resend_fetch_error"
    });
    return "error";
  }
}

export async function sendAuthOtpEmail(email: string, intent: "signup" | "login"): Promise<{ status: EmailSendResult; otp: string | null }> {
  const otp = generateOtpCode();
  const status = await sendWithResend({
    type: "auth_otp",
    to: email,
    subject: "Your PrivacyEraser verification code",
    text: `Your 6-digit verification code is: ${otp}\n\nUse this OTP to continue your ${intent} request.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h2 style="margin:0 0 8px">PrivacyEraser verification code</h2>
      <p style="margin:0 0 12px">Use this 6-digit code to continue your ${intent}:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:0 0 12px">${otp}</p>
      <p style="margin:0;color:#475569">This code expires shortly. If you did not request this, ignore this email.</p>
    </div>`
  });
  return { status, otp: status === "sent" ? otp : null };
}

export async function sendLifetimeWelcomeEmail(email: string): Promise<EmailSendResult> {
  return sendWithResend({
    type: "lifetime_welcome",
    to: email,
    subject: "Welcome to Lifetime Protection - PrivacyEraser",
    text: "Your Lifetime Protection is now active. We have started continuous monitoring and data-removal workflows on your behalf.",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h1 style="margin:0 0 10px">Welcome to Lifetime Protection</h1>
      <p style="margin:0 0 10px">Your PrivacyEraser lifetime plan is active.</p>
      <p style="margin:0 0 10px">Our automated removal and monitoring systems are now protecting your digital footprint.</p>
      <p style="margin:0;color:#334155">You can access your dashboard any time to review progress.</p>
    </div>`
  });
}

export async function sendBiWeeklyPrivacyAuditEmail(
  email: string,
  summary: {
    exposureScore: number;
    sourcesDetected: number;
    removalsInProgress: number;
    verifiedRemovals: number;
    scanId: string;
    riskLevel: string;
  }
): Promise<EmailSendResult> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://privacyeraser.ai").replace(/\/$/, "");
  const dashboardUrl = `${siteUrl}/dashboard`;
  return sendWithResend({
    type: "monthly_audit",
    to: email,
    subject: "Your Bi-Weekly Privacy & Dark Web Audit is Ready",
    text: `Your bi-weekly privacy and dark web audit is ready.

Exposure score: ${summary.exposureScore}/100 (${summary.riskLevel})
Sources detected: ${summary.sourcesDetected}
Removals in progress: ${summary.removalsInProgress}
Verified removals: ${summary.verifiedRemovals}

Review your dashboard: ${dashboardUrl}
Audit reference: ${summary.scanId}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:560px">
      <h1 style="margin:0 0 12px;font-size:22px">Your Bi-Weekly Privacy &amp; Dark Web Audit is Ready</h1>
      <p style="margin:0 0 16px;color:#334155">We completed a silent background check of your stored exposure profile and dark-web signals (no action required).</p>
      <table style="border-collapse:collapse;width:100%;margin:0 0 16px">
        <tr><td style="padding:8px;border:1px solid #e2e8f0">Exposure score</td><td style="padding:8px;border:1px solid #e2e8f0"><strong>${summary.exposureScore}/100</strong> (${summary.riskLevel})</td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0">Sources detected</td><td style="padding:8px;border:1px solid #e2e8f0"><strong>${summary.sourcesDetected}</strong></td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0">Removals in progress</td><td style="padding:8px;border:1px solid #e2e8f0"><strong>${summary.removalsInProgress}</strong></td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0">Verified removals</td><td style="padding:8px;border:1px solid #e2e8f0"><strong>${summary.verifiedRemovals}</strong></td></tr>
      </table>
      <p style="margin:0 0 14px"><a href="${dashboardUrl}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Open your dashboard</a></p>
      <p style="margin:0;font-size:12px;color:#64748b">Reference: ${summary.scanId}</p>
    </div>`
  });
}

export async function sendMonthlyPrivacyExposureReport(email: string, summary: {
  exposureScore: number;
  sourcesDetected: number;
  removalsInProgress: number;
  verifiedRemovals: number;
}): Promise<EmailSendResult> {
  return sendWithResend({
    type: "monthly_audit",
    to: email,
    subject: "Monthly Privacy Exposure Report - PrivacyEraser",
    text: `Monthly report:
- Exposure score: ${summary.exposureScore}
- Sources detected: ${summary.sourcesDetected}
- Removals in progress: ${summary.removalsInProgress}
- Verified removals: ${summary.verifiedRemovals}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 10px">Monthly Privacy Exposure Report</h2>
      <table style="border-collapse:collapse;width:100%;max-width:520px">
        <tr><td style="padding:8px;border:1px solid #e2e8f0">Exposure score</td><td style="padding:8px;border:1px solid #e2e8f0"><strong>${summary.exposureScore}</strong></td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0">Sources detected</td><td style="padding:8px;border:1px solid #e2e8f0"><strong>${summary.sourcesDetected}</strong></td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0">Removals in progress</td><td style="padding:8px;border:1px solid #e2e8f0"><strong>${summary.removalsInProgress}</strong></td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0">Verified removals</td><td style="padding:8px;border:1px solid #e2e8f0"><strong>${summary.verifiedRemovals}</strong></td></tr>
      </table>
      <p style="margin:12px 0 0;color:#334155">PrivacyEraser keeps tracking and removing exposed records continuously.</p>
    </div>`
  });
}

export async function sendSystemIntegrationSuccessfulEmail(email: string): Promise<EmailSendResult> {
  return sendWithResend({
    type: "integration_test",
    to: email,
    subject: "System Integration Successful - PrivacyEraser",
    text: "System integration successful. Resend email delivery is active for PrivacyEraser.ai.",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h2 style="margin:0 0 8px">System Integration Successful</h2>
      <p style="margin:0">Resend communication layer is active for PrivacyEraser.ai.</p>
    </div>`
  });
}

export async function sendRemovalRequestSentEmail(input: {
  to: string;
  brokerName: string;
}): Promise<EmailSendResult> {
  return sendWithResend({
    type: "removal_confirmation",
    to: input.to,
    subject: `Removal Request Sent - ${input.brokerName}`,
    text: `We sent a removal/opt-out request to ${input.brokerName} on your behalf.\n\nNext step: we will re-verify this source automatically and update your dashboard status.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 10px">Removal Request Sent</h2>
      <p style="margin:0 0 10px">We sent a removal/opt-out request to <strong>${input.brokerName}</strong> on your behalf.</p>
      <p style="margin:0;color:#334155">Next, we will automatically re-verify this source and update your dashboard status.</p>
    </div>`
  });
}

export async function sendCaseReportReadyEmail(input: { to: string; url: string }): Promise<EmailSendResult> {
  return sendWithResend({
    type: "removal_confirmation",
    to: input.to,
    subject: "Your Case Report is Ready - PrivacyEraser",
    text: `Your Case Report PDF is ready.\n\nDownload: ${input.url}\n\nThis link points to your stored evidence report.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 10px">Case Report Ready</h2>
      <p style="margin:0 0 10px">Your Case Report PDF is ready for download:</p>
      <p style="margin:0 0 14px"><a href="${input.url}" style="color:#4f46e5;font-weight:700">Download Case Report</a></p>
      <p style="margin:0;color:#334155">This report summarizes confirmed outbound removal operations.</p>
    </div>`
  });
}

// Backward compatibility for existing import sites.
export async function sendPurchaseOtp(email: string): Promise<EmailSendResult> {
  const { status } = await sendAuthOtpEmail(email, "login");
  return status;
}
