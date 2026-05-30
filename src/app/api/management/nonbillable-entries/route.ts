import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("personId");
  const month = searchParams.get("month");
  try {
    let dateFilter: { gte?: Date; lte?: Date } | undefined;
    if (month) {
      const d = new Date(month);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      dateFilter = { gte: start, lte: end };
    }
    const rows = await prisma.nonBillableEntry.findMany({
      where: {
        ...(personId ? { personId: Number(personId) } : {}),
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      orderBy: { date: "desc" },
      take: 200,
      select: {
        id: true, personId: true, squadId: true, date: true,
        hours: true, categoryId: true, notes: true, externalRef: true, createdAt: true,
        person: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
