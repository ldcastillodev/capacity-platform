import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lineItemId = searchParams.get("lineItemId");
  try {
    const rows = await prisma.changeOrderLineItemHistory.findMany({
      where: lineItemId ? { lineItemId: Number(lineItemId) } : undefined,
      orderBy: { changedAt: "desc" },
      take: 500,
      select: {
        id: true, lineItemId: true, changedAt: true, changedBy: true,
        prevHours: true, newHours: true, prevRateOverride: true, newRateOverride: true,
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
