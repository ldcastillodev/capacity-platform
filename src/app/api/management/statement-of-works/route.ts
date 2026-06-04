import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");

  const sows = await prisma.statementOfWork.findMany({
    where: clientId ? { clientId: Number(clientId) } : undefined,
    orderBy: [{ clientId: "asc" }, { startDate: "asc" }],
    select: {
      id: true,
      name: true,
      clientId: true,
      startDate: true,
      endDate: true,
      client: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(sows);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string;
    client_id: number;
    start_date: string;
    end_date?: string;
  };

  const sow = await prisma.statementOfWork.create({
    data: {
      name: body.name,
      clientId: body.client_id,
      startDate: new Date(body.start_date),
      endDate: body.end_date ? new Date(body.end_date) : null,
    },
    select: {
      id: true,
      name: true,
      clientId: true,
      startDate: true,
      endDate: true,
      client: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(sow, { status: 201 });
}
