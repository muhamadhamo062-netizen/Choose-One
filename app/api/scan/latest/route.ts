import { NextResponse } from "next/server";
import { getSessionUserIdFromCookies } from "@/lib/auth-cookies";
import { prisma } from "@/lib/prisma";
import { jsonUnauthorized } from "@/lib/api-response";
import { safeDbResult } from "@/lib/safe-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const byPublicId = searchParams.get("scanId")?.trim();
  const userId = await getSessionUserIdFromCookies();

  if (byPublicId) {
    const scanRes = await safeDbResult(() =>
      prisma.scan.findFirst({
        where: { publicScanId: byPublicId },
        include: { session: true }
      })
    );
    if (!scanRes.ok) {
      return NextResponse.json(
        { ok: false, error: "scan_unavailable", message: "Please try again." },
        { status: 200 }
      );
    }
    const scan = scanRes.value;
    if (!scan) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (scan.userId && userId && scan.userId !== userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ scan: toDto(scan) });
  }

  if (!userId) {
    return jsonUnauthorized();
  }

  const scanRes = await safeDbResult(() =>
    prisma.scan.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { session: true }
    })
  );
  if (!scanRes.ok) {
    return NextResponse.json(
      { ok: false, error: "scan_unavailable", message: "Please try again." },
      { status: 200 }
    );
  }
  const scan = scanRes.value;
  return NextResponse.json({ scan: scan ? toDto(scan) : null });
}

function toDto(scan: {
  publicScanId: string;
  exposureScore: number;
  brokersFound: number;
  state: string;
  riskLevel: string | null;
  fullName: string | null;
  email: string | null;
  createdAt: Date;
}) {
  return {
    scanId: scan.publicScanId,
    exposureScore: scan.exposureScore,
    brokersFound: scan.brokersFound,
    state: scan.state,
    riskLevel: scan.riskLevel,
    fullName: scan.fullName,
    email: scan.email,
    createdAt: scan.createdAt.toISOString()
  };
}
