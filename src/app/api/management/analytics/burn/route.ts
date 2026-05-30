import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  try {
    const rows = await prisma.weeklyBurnSnapshot.findMany({
      where: clientId ? { clientId: Number(clientId) } : undefined,
      orderBy: [{ weekStart: "desc" }, { clientId: "asc" }],
      take: 500,
      select: {
        id: true, clientId: true, weekStart: true, roleType: true,
        cumulativeHours: true, expectedCumulative: true, burnRateRatio: true,
        projectedEomHours: true, poolHours: true, alertLevel: true, createdAt: true,
        client: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
