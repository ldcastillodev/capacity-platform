import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json() as { name?: string; region?: string; currency?: string };

  const client = await prisma.client.update({
    where: { id: Number(id) },
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
