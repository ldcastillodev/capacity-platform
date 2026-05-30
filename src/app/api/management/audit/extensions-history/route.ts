import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const extensionId = searchParams.get("extensionId");
  try {
    const rows = await prisma.contractExtensionHistory.findMany({
      where: extensionId ? { extensionId: Number(extensionId) } : undefined,
      orderBy: { changedAt: "desc" },
      take: 500,
      select: {
        id: true, extensionId: true, changedAt: true, changedBy: true,
        prevStatus: true, newStatus: true,
        prevRequestedHours: true, newRequestedHours: true,
        prevRateOverride: true, newRateOverride: true,
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
