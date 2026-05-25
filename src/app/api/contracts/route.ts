import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");

  const contracts = await prisma.retainerContract.findMany({
    where: {
      status: "active",
      ...(clientId ? { clientId: Number(clientId) } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(contracts);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    client_id: number;
    squad_id: number;
    total_pool_hours: number;
    status?: string;
    valid_from: string;
    valid_to?: string;
  };

  const contract = await prisma.retainerContract.create({
    data: {
      clientId: body.client_id,
      squadId: body.squad_id,
      totalPoolHours: body.total_pool_hours,
      status: (body.status as never) ?? "active",
      validFrom: new Date(body.valid_from),
      validTo: body.valid_to ? new Date(body.valid_to) : null,
    },
  });
  return NextResponse.json(contract, { status: 201 });
}
