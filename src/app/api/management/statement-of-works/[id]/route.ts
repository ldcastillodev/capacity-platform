import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as {
    name?: string;
    start_date?: string;
    end_date?: string | null;
  };

  const sow = await prisma.statementOfWork.update({
    where: { id: Number(id) },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.start_date !== undefined && { startDate: new Date(body.start_date) }),
      ...(body.end_date !== undefined && {
        endDate: body.end_date ? new Date(body.end_date) : null,
      }),
    },
    select: {
      id: true,
      name: true,
      clientId: true,
      startDate: true,
      endDate: true,
      client: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(sow);
}
