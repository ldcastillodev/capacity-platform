import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");

  const orders = await prisma.changeOrder.findMany({
    where: clientId ? { clientId: Number(clientId) } : undefined,
    include: { lineItems: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    client_id: number;
    squad_id: number;
    date_range_start: string;
    date_range_end: string;
    notes?: string;
    line_items?: Array<{ role_type: string; hours: number; rate_override?: number }>;
  };

  const order = await prisma.changeOrder.create({
    data: {
      clientId: body.client_id,
      squadId: body.squad_id,
      dateRangeStart: new Date(body.date_range_start),
      dateRangeEnd: new Date(body.date_range_end),
      notes: body.notes ?? null,
      lineItems: body.line_items
        ? {
            create: body.line_items.map((li) => ({
              roleType: li.role_type as never,
              hours: li.hours,
              rateOverride: li.rate_override ?? null,
            })),
          }
        : undefined,
    },
    include: { lineItems: true },
  });
  return NextResponse.json(order, { status: 201 });
}
