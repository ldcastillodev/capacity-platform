import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ flagId: string }> },
) {
  const { flagId } = await params;
  const body = await req.json() as { resolution_notes?: string };

  const flag = await prisma.anomalyFlag.update({
    where: { id: Number(flagId) },
    data: {
      resolvedAt: new Date(),
      resolutionNotes: body.resolution_notes ?? null,
    },
  });
  return NextResponse.json(flag);
}
