import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const engagementId = searchParams.get("engagementId");
  try {
    const rows = await prisma.sMEEngagementHistory.findMany({
      where: engagementId ? { engagementId: Number(engagementId) } : undefined,
      orderBy: { changedAt: "desc" },
      take: 500,
      select: {
        id: true, engagementId: true, changedAt: true, changedBy: true,
        prevStatus: true, newStatus: true,
        prevBillingRate: true, newBillingRate: true,
        prevCostRate: true, newCostRate: true,
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
