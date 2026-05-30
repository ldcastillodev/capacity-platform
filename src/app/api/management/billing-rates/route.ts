import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  try {
    const rows = await prisma.billingRate.findMany({
      where: clientId ? { clientId: Number(clientId) } : undefined,
      orderBy: [{ clientId: "asc" }, { effectiveFrom: "desc" }],
      select: {
        id: true, clientId: true, roleType: true,
        ratePerHour: true, currency: true, effectiveFrom: true, effectiveTo: true,
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
      client_id: number; role_type?: string; rate_per_hour: number;
      currency: string; effective_from: string; effective_to?: string;
    };
    const row = await prisma.billingRate.create({
      data: {
        clientId: body.client_id,
        roleType: body.role_type as never ?? null,
        ratePerHour: body.rate_per_hour,
        currency: body.currency as never,
        effectiveFrom: new Date(body.effective_from),
        effectiveTo: body.effective_to ? new Date(body.effective_to) : null,
      },
      select: {
        id: true, clientId: true, roleType: true,
        ratePerHour: true, currency: true, effectiveFrom: true, effectiveTo: true,
        client: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002")
      return NextResponse.json({ error: "Rate already exists for this client/role/date." }, { status: 400 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
