import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const squadId = searchParams.get("squad_id");

  if (!month) {
    return NextResponse.json({ error: "month required" }, { status: 400 });
  }

  const monthDate = new Date(month);
  const monthEnd = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0));

  const entries = await prisma.hourRecord.findMany({
    where: {
      isNonBillable: true,
      ...(squadId
        ? { person: { squadMemberships: { some: { squadId: Number(squadId) } } } }
        : {}),
      date: { gte: monthDate, lte: monthEnd },
    },
    include: { person: { include: { roles: { where: { effectiveTo: null } } } } },
  });

  const byRole: Record<string, number> = {};
  for (const entry of entries) {
    const role = entry.person.roles[0]?.roleType ?? "unknown";
    byRole[role] = (byRole[role] ?? 0) + Number(entry.hours);
  }

  return NextResponse.json(byRole);
}
