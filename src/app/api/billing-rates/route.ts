import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const rates = await prisma.billingRate.findMany({ orderBy: { effectiveFrom: "desc" } });
  return NextResponse.json(rates);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    client_id: number;
    role_type?: string;
    rate_per_hour: number;
    currency: string;
    effective_from: string;
  };

  const rate = await prisma.billingRate.create({
    data: {
      clientId: body.client_id,
      roleType: (body.role_type as never) ?? null,
      ratePerHour: body.rate_per_hour,
      currency: body.currency as never,
      effectiveFrom: new Date(body.effective_from),
    },
  });
  return NextResponse.json(rate, { status: 201 });
}
