import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");
  const monthParam = searchParams.get("month");
  const weekStart = searchParams.get("week_start");
  const weekEnd = searchParams.get("week_end");

  let weekStartFilter: { gte?: Date; lt?: Date; lte?: Date } = {};

  if (weekStart || weekEnd) {
    if (weekStart) weekStartFilter.gte = new Date(weekStart);
    if (weekEnd) weekStartFilter.lte = new Date(weekEnd);
  } else if (monthParam) {
    const monthDate = new Date(monthParam);
    const nextMonth = new Date(monthDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    weekStartFilter = { gte: monthDate, lt: nextMonth };
  }

  const snapshots = await prisma.weeklyBurnSnapshot.findMany({
    where: {
      ...(clientId ? { clientId: Number(clientId) } : {}),
      ...(Object.keys(weekStartFilter).length > 0 ? { weekStart: weekStartFilter } : {}),
    },
    include: { client: true },
    orderBy: [{ weekStart: "asc" }, { clientId: "asc" }],
    take: 500,
  });

  return NextResponse.json(snapshots);
}
