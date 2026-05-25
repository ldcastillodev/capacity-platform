import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const personId = searchParams.get("person_id");
  const clientId = searchParams.get("client_id");

  // Per-person detail if person_id provided
  if (personId) {
    const rows = await prisma.monthlyCeremonyAllocation.findMany({
      where: {
        personId: Number(personId),
        ...(month ? { month: new Date(month) } : {}),
        ...(clientId ? { clientId: Number(clientId) } : {}),
      },
      include: { person: true, client: true, squad: true },
      orderBy: [{ month: "desc" }, { personId: "asc" }],
    });
    return NextResponse.json(rows);
  }

  // Aggregate by client for consumption page view
  const grouped = await prisma.monthlyCeremonyAllocation.groupBy({
    by: ["clientId", "month"],
    where: {
      ...(month ? { month: new Date(month) } : {}),
      ...(clientId ? { clientId: Number(clientId) } : {}),
    },
    _sum: { allocatedHours: true },
  });

  const result = grouped.map((g) => ({
    client_id: g.clientId,
    month: g.month,
    total_allocated_hours: Number(g._sum.allocatedHours ?? 0),
  }));

  return NextResponse.json(result);
}
