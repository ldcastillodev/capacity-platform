import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json() as {
    hours?: number;
    target_month?: string;
    reason?: string | null;
  };

  const extension = await prisma.extension.update({
    where: { id: Number(id) },
    data: {
      ...(body.hours !== undefined && { hours: body.hours }),
      ...(body.target_month !== undefined && { targetMonth: new Date(body.target_month) }),
      ...(body.reason !== undefined && { reason: body.reason }),
    },
    select: {
      id: true,
      contractId: true,
      hours: true,
      reason: true,
      targetMonth: true,
      contract: {
        select: {
          id: true,
          name: true,
          sow: {
            select: {
              id: true,
              name: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  return NextResponse.json(extension);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.extension.delete({ where: { id: Number(id) } });
  return NextResponse.json({ success: true });
}
