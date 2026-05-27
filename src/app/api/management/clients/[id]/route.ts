import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const clientId = Number(id);
  const body = await req.json() as { name?: string; region?: string; currency?: string };

  // Guard: block currency change if billing records already exist
  if (body.currency !== undefined) {
    const [hourCount, rateCount] = await Promise.all([
      prisma.hourRecord.count({ where: { clientId } }),
      prisma.billingRate.count({ where: { clientId } }),
    ]);
    if (hourCount > 0 || rateCount > 0) {
      return NextResponse.json(
        { error: "Cannot change currency after billing records exist." },
        { status: 400 },
      );
    }
  }

  const client = await prisma.client.update({
    where: { id: clientId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.region !== undefined && { region: body.region as never }),
      ...(body.currency !== undefined && { currency: body.currency as never }),
    },
    select: {
      id: true,
      name: true,
      region: true,
      currency: true,
      isActive: true,
      createdAt: true,
      retainerContracts: { select: { id: true } },
    },
  });
  return NextResponse.json(client);
}
