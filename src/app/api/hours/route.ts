import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");
  const personId = searchParams.get("person_id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  const records = await prisma.hourRecord.findMany({
    where: {
      ...(clientId ? { clientId: Number(clientId) } : {}),
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
    orderBy: { date: "desc" },
    take: 500,
  });
  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    person_id: number;
    client_id: number;
    squad_id: number;
    date: string;
    hours: number;
    role_type: string;
  };

  const record = await prisma.hourRecord.create({
    data: {
      personId: body.person_id,
      clientId: body.client_id,
      squadId: body.squad_id,
      date: new Date(body.date),
      hours: body.hours,
      roleType: body.role_type as never,
      source: "manual",
    },
  });
  return NextResponse.json(record, { status: 201 });
}
