import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const rate = await prisma.billingRate.findUnique({ where: { id: Number(id) } });
    if (!rate) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const hourCount = await prisma.hourRecord.count({
      where: {
        clientId: rate.clientId,
        ...(rate.roleType ? { roleType: rate.roleType } : {}),
        date: {
          gte: rate.effectiveFrom,
          ...(rate.effectiveTo ? { lte: rate.effectiveTo } : {}),
        },
      },
    });
    if (hourCount > 0)
      return NextResponse.json(
        { error: `Cannot delete: ${hourCount} hour record(s) reference this rate period.` },
        { status: 400 },
      );

    await prisma.billingRate.delete({ where: { id: Number(id) } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
