import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const month = searchParams.get("month");
  try {
    const rows = await prisma.monthlyConsumptionSummary.findMany({
      where: {
        ...(clientId ? { clientId: Number(clientId) } : {}),
        ...(month ? { month: new Date(month) } : {}),
      },
      orderBy: [{ month: "desc" }, { clientId: "asc" }],
      take: 500,
      select: {
        id: true, clientId: true, month: true, roleType: true,
        declaredHours: true, consumedHours: true, remainingHours: true,
        utilizationPct: true, billedRevenue: true, lastRefreshed: true,
        client: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
