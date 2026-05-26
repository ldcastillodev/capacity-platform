import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.$transaction([
    prisma.squadMembership.updateMany({
      where: { squadId: Number(id), effectiveTo: null },
      data: { effectiveTo: today },
    }),
    prisma.squad.update({
      where: { id: Number(id) },
      data: { isActive: false },
    }),
  ]);

  return NextResponse.json({ success: true });
}
