import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const personId = Number(id);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.$transaction([
    prisma.squadMembership.updateMany({
      where: { personId, effectiveTo: null },
      data: { effectiveTo: today },
    }),
    prisma.squad.updateMany({
      where: { leadPersonId: personId },
      data: { leadPersonId: null },
    }),
    prisma.person.update({
      where: { id: personId },
      data: { isActive: false },
    }),
  ]);

  return NextResponse.json({ success: true });
}
