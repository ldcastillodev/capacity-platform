import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const squadId = searchParams.get("squadId");
  const month = searchParams.get("month");
  try {
    const rows = await prisma.staffingGapSnapshot.findMany({
      where: {
        ...(squadId ? { squadId: Number(squadId) } : {}),
        ...(month ? { month: new Date(month) } : {}),
      },
      orderBy: [{ month: "desc" }, { squadId: "asc" }],
      take: 500,
      select: {
        id: true, squadId: true, roleType: true, month: true,
        totalAvailableHours: true, committedHours: true, netGapHours: true,
        isUnderstaffed: true, isOverstaffed: true, calculatedAt: true,
        squad: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
