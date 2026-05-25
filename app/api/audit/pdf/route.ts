import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-session";
import { safeDbResult } from "@/lib/safe-db";

export const dynamic = "force-dynamic";

function buildLuxuryHtml(input: {
  scanId: string;
  email: string | null;
  fullName: string | null;
  exposureScore: number;
  brokersFound: number;
  riskLevel: string | null;
  createdAt: Date;
}): string {
  const title = "Luxury Privacy Audit Report";
  const sub = input.email ? input.email : "Unknown user";
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; margin: 0; color: #0f172a; }
      .page { padding: 36px; }
      .top { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; }
      .k { font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: #64748b; font-weight: 800; }
      .h { font-size: 28px; font-weight: 900; margin: 10px 0 6px; }
      .sub { color:#334155; font-size: 13px; margin: 0; }
      .card { margin-top: 22px; border-radius: 16px; padding: 18px; border: 1px solid #e2e8f0; background: linear-gradient(180deg,#ffffff,#f8fafc); }
      .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
      .m { border-radius: 14px; padding: 14px; border: 1px solid #e2e8f0; background:#fff; }
      .ml { font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color:#64748b; font-weight: 900; }
      .mv { font-size: 16px; font-weight: 900; margin-top: 6px; }
      .danger { color:#b91c1c; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace; font-size: 11px; color:#334155; }
      .stamp { margin-top: 16px; font-size: 11px; color:#64748b; }
      .footer { margin-top: 18px; font-size: 11px; color:#475569; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="top">
        <div>
          <div class="k">PrivacyEraser • Audit Packet</div>
          <div class="h">${title}</div>
          <p class="sub">Prepared for <strong>${sub}</strong></p>
        </div>
        <div class="mono">
          Scan ID: <strong>${input.scanId}</strong><br/>
          Generated: <strong>${new Date().toISOString()}</strong>
        </div>
      </div>

      <div class="card">
        <div class="k">Executive Summary</div>
        <div class="grid">
          <div class="m">
            <div class="ml">Exposure score</div>
            <div class="mv danger">${input.exposureScore}%</div>
          </div>
          <div class="m">
            <div class="ml">Sources detected</div>
            <div class="mv">${input.brokersFound}</div>
          </div>
          <div class="m">
            <div class="ml">Risk level</div>
            <div class="mv">${input.riskLevel ?? "UNKNOWN"}</div>
          </div>
          <div class="m">
            <div class="ml">Scan timestamp</div>
            <div class="mv">${input.createdAt.toISOString()}</div>
          </div>
        </div>
        <div class="footer">
          This report confirms your scan was processed and persisted in our secure vault. If you purchased Nuke, removal requests
          will be logged and visible in your dashboard.
        </div>
        <div class="stamp">PrivacyEraser — Audit-grade evidence export</div>
      </div>
    </div>
  </body>
</html>`;
}

async function generatePdf(html: string): Promise<Buffer> {
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scanId = url.searchParams.get("scanId")?.trim() || "";
  if (!scanId) {
    return NextResponse.json({ ok: false, error: "missing_scanId" }, { status: 400 });
  }

  // Optional auth: if authed, we associate userId; otherwise we still allow download by scanId.
  const session = await getSession();
  const userId = session.kind === "authed" ? session.userId : null;

  const existingRes = await safeDbResult(() =>
    prisma.auditPdf.findUnique({
      where: { scanId },
      select: { pdfBytes: true }
    })
  );
  if (existingRes.ok && existingRes.value?.pdfBytes) {
    return new NextResponse(existingRes.value.pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="privacy-audit-${scanId}.pdf"`,
        "Cache-Control": "no-store"
      }
    });
  }

  const scanRes = await safeDbResult(() =>
    prisma.scan.findUnique({
      where: { publicScanId: scanId },
      select: {
        publicScanId: true,
        userId: true,
        exposureScore: true,
        brokersFound: true,
        riskLevel: true,
        fullName: true,
        email: true,
        createdAt: true
      }
    })
  );
  if (!scanRes.ok || !scanRes.value) {
    return NextResponse.json({ ok: false, error: "scan_not_found" }, { status: 404 });
  }

  const scan = scanRes.value;
  const html = buildLuxuryHtml({
    scanId: scan.publicScanId,
    email: scan.email ?? null,
    fullName: scan.fullName ?? null,
    exposureScore: scan.exposureScore,
    brokersFound: scan.brokersFound,
    riskLevel: scan.riskLevel ?? null,
    createdAt: scan.createdAt
  });
  const pdf = await generatePdf(html);

  void safeDbResult(() =>
    prisma.auditPdf.create({
      data: {
        scanId: scan.publicScanId,
        userId: scan.userId ?? userId,
        pdfBytes: pdf
      }
    })
  );

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="privacy-audit-${scanId}.pdf"`,
      "Cache-Control": "no-store"
    }
  });
}

