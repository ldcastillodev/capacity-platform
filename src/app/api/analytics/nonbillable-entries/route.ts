import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("person_id");
  const squadId = searchParams.get("squad_id");
  const month = searchParams.get("month");

  if (!personId || !month) {
    return NextResponse.json({ error: "person_id and month required" }, { status: 400 });
  }

  const monthDate = new Date(month + "T00:00:00");
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

  const entries = await prisma.nonBillableEntry.findMany({
    where: {
      personId: Number(personId),
      ...(squadId ? { squadId: Number(squadId) } : {}),
      date: { gte: monthDate, lte: monthEnd },
    },
    include: { category: true },
    orderBy: { date: "asc" },
  });

  // Group by category type → category name
  const groups: Record<string, {
    category_type: string;
    category_name: string;
    total_hours: number;
    entries: Array<{ date: string; hours: number; external_ref: string | null; notes: string | null }>;
  }> = {};

  for (const e of entries) {
    const key = `${e.category.type}|${e.category.name}`;
    if (!groups[key]) {
      groups[key] = {
        category_type: e.category.type,
        category_name: e.category.name,
        total_hours: 0,
        entries: [],
      };
    }
    groups[key].total_hours += Number(e.hours);
    groups[key].entries.push({
      date: e.date.toISOString().substring(0, 10),
      hours: Number(e.hours),
      external_ref: e.externalRef ?? null,
      notes: e.notes ?? null,
    });
  }

  return NextResponse.json(Object.values(groups));
}
