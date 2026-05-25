import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");

  const engagements = await prisma.sMEEngagement.findMany({
    where: clientId ? { clientId: Number(clientId) } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(engagements);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    client_id: number;
    squad_id: number;
    month: string;
    role_description: string;
    source: string;
    person_id?: number;
    contracted_hours: number;
    cost_rate: number;
    billing_rate: number;
    currency: string;
  };

  const engagement = await prisma.sMEEngagement.create({
    data: {
      clientId: body.client_id,
      squadId: body.squad_id,
      month: new Date(body.month),
      roleDescription: body.role_description,
      source: body.source as never,
      personId: body.person_id ?? null,
      contractedHours: body.contracted_hours,
      costRate: body.cost_rate,
      billingRate: body.billing_rate,
      currency: body.currency as never,
    },
  });
  return NextResponse.json(engagement, { status: 201 });
}
