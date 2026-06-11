import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("person_id");
  const month = searchParams.get("month");

  if (!personId || !month) {
    return NextResponse.json({ error: "person_id and month required" }, { status: 400 });
  }

  const monthDate = new Date(month);
  const monthEnd = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0));

  const entries = await prisma.hourRecord.findMany({
    where: {
      personId: Number(personId),
      isNonBillable: true,
      date: { gte: monthDate, lte: monthEnd },
    },
    include: { nonBillableCategory: true },
    orderBy: { date: "asc" },
  });

  const groups: Record<string, {
    category_type: string;
    category_name: string;
    total_hours: number;
    entries: Array<{ date: string; hours: number; issue_key: string | null }>;
  }> = {};

  for (const e of entries) {
    if (!e.nonBillableCategory) continue;
    const key = `${e.nonBillableCategory.type}|${e.nonBillableCategory.name}`;
    if (!groups[key]) {
      groups[key] = {
        category_type: e.nonBillableCategory.type,
        category_name: e.nonBillableCategory.name,
        total_hours: 0,
        entries: [],
      };
    }
    groups[key].total_hours += Number(e.hours);
    groups[key].entries.push({
      date: e.date.toISOString().substring(0, 10),
      hours: Number(e.hours),
      issue_key: e.issueKey ?? null,
    });
  }

  return NextResponse.json(Object.values(groups));
}
