import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  try {
    const rows = await prisma.tEBillingConfig.findMany({
      where: clientId ? { clientId: Number(clientId) } : undefined,
      select: {
        id: true, clientId: true, type: true, value: true, currency: true,
        client: { select: { id: true, name: true } },
        _count: { select: { roleRates: true } },
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
      client_id: number; type: string; value?: number; currency?: string;
    };
    const row = await prisma.tEBillingConfig.create({
      data: {
        clientId: body.client_id,
        type: body.type as never,
        value: body.value ?? null,
        currency: body.currency as never ?? null,
      },
      select: {
        id: true, clientId: true, type: true, value: true, currency: true,
        client: { select: { id: true, name: true } },
        _count: { select: { roleRates: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002")
      return NextResponse.json({ error: "A TE billing config already exists for this client." }, { status: 400 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
