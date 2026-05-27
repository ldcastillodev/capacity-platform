import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ flagId: string }> },
) {
  const { flagId } = await params;
  const body = await req.json() as { resolution_note?: string };

  const flag = await prisma.anomalyFlag.update({
    where: { id: Number(flagId) },
    data: {
      resolvedAt: new Date(),
      resolutionNotes: body.resolution_note ?? null,
    },
  });
  return NextResponse.json(flag);
}
