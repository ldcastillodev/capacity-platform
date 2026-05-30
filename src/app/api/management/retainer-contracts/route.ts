import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const status = searchParams.get("status");
  try {
    const rows = await prisma.retainerContract.findMany({
      where: {
        ...(clientId ? { clientId: Number(clientId) } : {}),
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { validFrom: "desc" },
      select: {
        id: true, clientId: true, squadId: true,
        totalPoolHours: true, status: true, validFrom: true, validTo: true, createdAt: true,
        client: { select: { id: true, name: true } },
        squad: { select: { id: true, name: true } },
        _count: { select: { declarations: true, amendments: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      client_id: number; squad_id: number;
      total_pool_hours: number; valid_from: string; valid_to?: string;
    };
    const row = await prisma.retainerContract.create({
      data: {
        clientId: body.client_id,
        squadId: body.squad_id,
        totalPoolHours: body.total_pool_hours,
        validFrom: new Date(body.valid_from),
        validTo: body.valid_to ? new Date(body.valid_to) : null,
      },
      select: {
        id: true, clientId: true, squadId: true,
        totalPoolHours: true, status: true, validFrom: true, validTo: true, createdAt: true,
        client: { select: { id: true, name: true } },
        squad: { select: { id: true, name: true } },
        _count: { select: { declarations: true, amendments: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
