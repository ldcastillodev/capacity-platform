import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const row = await prisma.nonBillableCategory.update({
      where: { id: Number(id) },
      data: { isActive: false, deactivatedAt: new Date() },
      select: {
        id: true, name: true, type: true, isActive: true, deactivatedAt: true,
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
