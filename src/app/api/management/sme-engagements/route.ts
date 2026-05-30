import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const status = searchParams.get("status");
  try {
    const rows = await prisma.sMEEngagement.findMany({
      where: {
        ...(clientId ? { clientId: Number(clientId) } : {}),
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, clientId: true, squadId: true, month: true,
        roleDescription: true, source: true, personId: true,
        contractedHours: true, costRate: true, billingRate: true,
        currency: true, approvedBy: true, status: true, createdAt: true,
        client: { select: { id: true, name: true } },
        squad: { select: { id: true, name: true } },
        person: { select: { id: true, name: true } },
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
      client_id: number; squad_id: number; month: string;
      role_description: string; source: string; person_id?: number;
      contracted_hours: number; cost_rate: number; billing_rate: number; currency: string;
    };
    const row = await prisma.sMEEngagement.create({
      data: {
        clientId: body.client_id, squadId: body.squad_id,
        month: new Date(body.month),
        roleDescription: body.role_description,
        source: body.source as never,
        personId: body.person_id ?? null,
        contractedHours: body.contracted_hours,
        costRate: body.cost_rate, billingRate: body.billing_rate,
        currency: body.currency as never,
      },
      select: {
        id: true, clientId: true, squadId: true, month: true,
        roleDescription: true, source: true, personId: true,
        contractedHours: true, costRate: true, billingRate: true,
        currency: true, status: true, createdAt: true,
        client: { select: { id: true, name: true } },
        squad: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
