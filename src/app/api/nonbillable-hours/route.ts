import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("person_id");
  const squadId = searchParams.get("squad_id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  const entries = await prisma.nonBillableEntry.findMany({
    where: {
      ...(personId ? { personId: Number(personId) } : {}),
      ...(squadId ? { squadId: Number(squadId) } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    },
    include: { category: true },
    orderBy: { date: "desc" },
    take: 500,
  });
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    person_id: number;
    squad_id: number;
    date: string;
    hours: number;
    category_id: number;
    notes?: string;
  };

  const entry = await prisma.nonBillableEntry.create({
    data: {
      personId: body.person_id,
      squadId: body.squad_id,
      date: new Date(body.date),
      hours: body.hours,
      categoryId: body.category_id,
      notes: body.notes ?? null,
    },
  });
  return NextResponse.json(entry, { status: 201 });
}
