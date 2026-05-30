import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("personId");
  const squadId = searchParams.get("squadId");
  const month = searchParams.get("month");
  try {
    const rows = await prisma.monthlyNonBillableSummary.findMany({
      where: {
        ...(personId ? { personId: Number(personId) } : {}),
        ...(squadId ? { squadId: Number(squadId) } : {}),
        ...(month ? { month: new Date(month) } : {}),
      },
      orderBy: [{ month: "desc" }, { personId: "asc" }],
      take: 500,
      select: {
        id: true, personId: true, squadId: true, month: true, categoryType: true,
        totalHours: true, nonbillablePct: true, lastRefreshed: true,
        person: { select: { id: true, name: true } },
        squad: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
