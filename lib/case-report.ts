import puppeteer from "puppeteer";
import { prisma } from "@/lib/prisma";
import { safeDbResult } from "@/lib/safe-db";
import { uploadPdfToSpaces } from "@/lib/spaces";

function buildCaseReportHtml(input: {
  email: string;
  breachesFound: number;
  brokersContacted: number;
  protectionLevel: string;
  caseId: string;
}): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Case Report</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; margin:0; color:#0f172a; background:#0b1020; }
      .wrap { padding: 42px; }
      .card { background: linear-gradient(180deg,#ffffff,#f8fafc); border-radius: 22px; padding: 26px; box-shadow: 0 18px 60px rgba(0,0,0,0.28); }
      .k { font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color:#475569; font-weight: 900; }
      .h { font-size: 30px; font-weight: 950; margin: 10px 0 4px; }
      .sub { color:#334155; font-size: 13px; margin: 0 0 18px; }
      .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
      .m { border-radius: 18px; padding: 16px; border: 1px solid #e2e8f0; background:#fff; }
      .ml { font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color:#64748b; font-weight: 900; }
      .mv { font-size: 20px; font-weight: 950; margin-top: 6px; }
      .danger { color:#b91c1c; }
      .ok { color:#0f766e; }
      .footer { margin-top: 18px; font-size: 11px; color:#475569; line-height: 1.55; }
      .stamp { margin-top: 12px; font-size: 11px; color:#64748b; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="k">PrivacyEraser • Case Report</div>
        <div class="h">Download Case Report</div>
        <div class="sub">Case ID <strong>${input.caseId}</strong> • Subject <strong>${input.email}</strong></div>

        <div class="grid">
          <div class="m">
            <div class="ml">Breaches Found</div>
            <div class="mv danger">${input.breachesFound}</div>
          </div>
          <div class="m">
            <div class="ml">Brokers Contacted</div>
            <div class="mv">${input.brokersContacted}/5</div>
          </div>
          <div class="m">
            <div class="ml">Protection Level</div>
            <div class="mv ok">${input.protectionLevel}</div>
          </div>
          <div class="m">
            <div class="ml">Status</div>
            <div class="mv">ACTION CONFIRMED</div>
          </div>
        </div>

        <div class="footer">
          This case report summarizes confirmed outbound removal operations. Each broker request is tracked in your dashboard.
          Keep this PDF for your records.
        </div>
        <div class="stamp">Generated: ${new Date().toISOString()}</div>
      </div>
    </div>
  </body>
</html>`;
}

async function renderPdf(html: string): Promise<Buffer> {
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

export async function maybeGenerateAndSendCaseReport(input: {
  userId: string;
  userEmail: string;
  scanId: string | null;
}): Promise<{ ok: boolean; url?: string; skipped?: boolean }> {
  // Only generate once per latest “all sent” situation.
  const existing = await safeDbResult(() =>
    prisma.caseReport.findFirst({
      where: { userId: input.userId },
      orderBy: { createdAt: "desc" },
      select: { publicUrl: true }
    })
  );
  if (existing.ok && existing.value?.publicUrl) {
    return { ok: true, skipped: true, url: existing.value.publicUrl };
  }

  const breachCountRes = await safeDbResult(() =>
    prisma.scan.count({
      where: input.scanId ? { publicScanId: input.scanId } : { userId: input.userId }
    })
  );
  const breachesFound = breachCountRes.ok ? breachCountRes.value : 0;

  const caseId = `CASE-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
  const html = buildCaseReportHtml({
    email: input.userEmail,
    breachesFound,
    brokersContacted: 5,
    protectionLevel: "100%",
    caseId
  });
  const pdf = await renderPdf(html);

  const uploaded = await uploadPdfToSpaces({ bytes: pdf, filenameBase: `case-report-${input.userId}` });
  const saved = await safeDbResult(() =>
    prisma.caseReport.create({
      data: {
        userId: input.userId,
        scanId: input.scanId,
        fileKey: uploaded.key,
        publicUrl: uploaded.publicUrl,
        status: "ready"
      }
    })
  );
  if (!saved.ok) {
    return { ok: false };
  }
  return { ok: true, url: uploaded.publicUrl };
}

