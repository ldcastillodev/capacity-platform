import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");
  try {
    const rows = await prisma.syncLog.findMany({
      where: source ? { source: source as never } : undefined,
      orderBy: { startedAt: "desc" },
      take: 200,
      select: {
        id: true, source: true, startedAt: true, completedAt: true,
        dateFrom: true, dateTo: true,
        recordsFetched: true, recordsCreated: true, recordsSkipped: true, recordsConflicted: true,
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
