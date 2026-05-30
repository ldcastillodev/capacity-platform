import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const changeOrderId = searchParams.get("changeOrderId");
  try {
    const rows = await prisma.changeOrderHistory.findMany({
      where: changeOrderId ? { changeOrderId: Number(changeOrderId) } : undefined,
      orderBy: { changedAt: "desc" },
      take: 500,
      select: {
        id: true, changeOrderId: true, changedAt: true, changedBy: true,
        prevStatus: true, newStatus: true, prevNotes: true,
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
