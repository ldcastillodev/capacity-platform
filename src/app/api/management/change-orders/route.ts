import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const status = searchParams.get("status");
  try {
    const rows = await prisma.changeOrder.findMany({
      where: {
        ...(clientId ? { clientId: Number(clientId) } : {}),
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, clientId: true, squadId: true, status: true,
        dateRangeStart: true, dateRangeEnd: true,
        writtenApprovalRef: true, writtenApprovalAt: true,
        docusignEnvelopeId: true, docusignSignedAt: true, notes: true, createdAt: true,
        client: { select: { id: true, name: true } },
        squad: { select: { id: true, name: true } },
        _count: { select: { lineItems: true } },
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
      date_range_start: string; date_range_end: string; notes?: string;
    };
    const row = await prisma.changeOrder.create({
      data: {
        clientId: body.client_id,
        squadId: body.squad_id,
        dateRangeStart: new Date(body.date_range_start),
        dateRangeEnd: new Date(body.date_range_end),
        notes: body.notes ?? null,
      },
      select: {
        id: true, clientId: true, squadId: true, status: true,
        dateRangeStart: true, dateRangeEnd: true,
        writtenApprovalRef: true, writtenApprovalAt: true,
        docusignEnvelopeId: true, docusignSignedAt: true, notes: true, createdAt: true,
        client: { select: { id: true, name: true } },
        squad: { select: { id: true, name: true } },
        _count: { select: { lineItems: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
