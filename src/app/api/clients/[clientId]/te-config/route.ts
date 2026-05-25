import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const config = await prisma.tEBillingConfig.findUnique({
    where: { clientId: Number(clientId) },
    include: { roleRates: true },
  });
  if (!config) return NextResponse.json(null);
  return NextResponse.json(config);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const body = await req.json() as {
    type: string;
    value?: number;
    currency?: string;
  };

  const config = await prisma.tEBillingConfig.upsert({
    where: { clientId: Number(clientId) },
    create: {
      clientId: Number(clientId),
      type: body.type as never,
      value: body.value ?? null,
      currency: (body.currency as never) ?? null,
    },
    update: {
      type: body.type as never,
      value: body.value ?? null,
      currency: (body.currency as never) ?? null,
    },
  });
  return NextResponse.json(config);
}
