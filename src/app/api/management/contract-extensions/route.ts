import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const status = searchParams.get("status");
  try {
    const rows = await prisma.contractExtension.findMany({
      where: {
        ...(clientId ? { clientId: Number(clientId) } : {}),
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, clientId: true, month: true, type: true, status: true,
        requestedHours: true, roleType: true, rateOverride: true,
        approvedBy: true, approvedAt: true, notes: true, createdAt: true,
        client: { select: { id: true, name: true } },
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
      client_id: number; month: string; type?: string;
      requested_hours: number; role_type?: string;
      rate_override?: number; notes?: string;
    };
    const row = await prisma.contractExtension.create({
      data: {
        clientId: body.client_id,
        month: new Date(body.month),
        type: body.type as never ?? "te",
        requestedHours: body.requested_hours,
        roleType: body.role_type as never ?? null,
        rateOverride: body.rate_override ?? null,
        notes: body.notes ?? null,
      },
      select: {
        id: true, clientId: true, month: true, type: true, status: true,
        requestedHours: true, roleType: true, rateOverride: true,
        approvedBy: true, approvedAt: true, notes: true, createdAt: true,
        client: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
