import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("person_id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  const entries = await prisma.hourRecord.findMany({
    where: {
      isNonBillable: true,
      ...(personId ? { personId: Number(personId) } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    },
    include: { nonBillableCategory: true },
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
  };

  const entry = await prisma.hourRecord.create({
    data: {
      personId: body.person_id,
      squadId: body.squad_id,
      clientId: null,
      date: new Date(body.date),
      hours: body.hours,
      roleType: null,
      source: "manual",
      isNonBillable: true,
      nonBillableCategoryId: body.category_id,
    },
  });
  return NextResponse.json(entry, { status: 201 });
}
