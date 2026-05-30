import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("personId");
  const month = searchParams.get("month");
  try {
    const rows = await prisma.monthlyCeremonyAllocation.findMany({
      where: {
        ...(personId ? { personId: Number(personId) } : {}),
        ...(month ? { month: new Date(month) } : {}),
      },
      orderBy: [{ month: "desc" }, { personId: "asc" }],
      take: 500,
      select: {
        id: true, personId: true, clientId: true, squadId: true,
        month: true, allocatedHours: true, lastRefreshed: true,
        person: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
