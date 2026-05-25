import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("person_id");

  const rates = await prisma.costRate.findMany({
    where: personId ? { personId: Number(personId) } : undefined,
    orderBy: { effectiveFrom: "desc" },
  });
  return NextResponse.json(rates);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    person_id?: number;
    role_type?: string;
    rate_per_hour: number;
    currency: string;
    effective_from: string;
  };

  const rate = await prisma.costRate.create({
    data: {
      personId: body.person_id ?? null,
      roleType: (body.role_type as never) ?? null,
      ratePerHour: body.rate_per_hour,
      currency: body.currency as never,
      effectiveFrom: new Date(body.effective_from),
    },
  });
  return NextResponse.json(rate, { status: 201 });
}
