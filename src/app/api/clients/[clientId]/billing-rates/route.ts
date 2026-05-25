import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const rates = await prisma.billingRate.findMany({
    where: { clientId: Number(clientId) },
    orderBy: { effectiveFrom: "desc" },
  });
  return NextResponse.json(rates);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const body = await req.json() as {
    role_type?: string;
    rate_per_hour: number;
    currency: string;
    effective_from: string;
    effective_to?: string;
  };

  const rate = await prisma.billingRate.create({
    data: {
      clientId: Number(clientId),
      roleType: (body.role_type as never) ?? null,
      ratePerHour: body.rate_per_hour,
      currency: body.currency as never,
      effectiveFrom: new Date(body.effective_from),
      effectiveTo: body.effective_to ? new Date(body.effective_to) : null,
    },
  });
  return NextResponse.json(rate, { status: 201 });
}
