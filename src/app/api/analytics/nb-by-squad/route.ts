import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const monthDate = month
    ? new Date(month)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const rows = await prisma.monthlyNonBillableSummary.findMany({
    where: { month: monthDate, categoryType: null },
    include: { squad: { select: { id: true, name: true } } },
  });

  const bySquad = new Map<number, { name: string; totalHours: number; capacityHours: number }>();
  for (const row of rows) {
    const entry = bySquad.get(row.squadId) ?? { name: row.squad.name, totalHours: 0, capacityHours: 0 };
    entry.totalHours += Number(row.totalHours);
    entry.capacityHours += Number(row.capacityHours);
    bySquad.set(row.squadId, entry);
  }

  const result = [...bySquad.entries()]
    .map(([squad_id, { name, totalHours, capacityHours }]) => ({
      squad_id,
      squad_name: name,
      total_hours: totalHours,
      capacity_hours: capacityHours,
      nb_pct: capacityHours > 0 ? totalHours / capacityHours : 0,
    }))
    .sort((a, b) => b.nb_pct - a.nb_pct);

  return NextResponse.json(result);
}
