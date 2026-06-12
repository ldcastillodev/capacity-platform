import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  try {
    const rows = await prisma.syncConflict.findMany({
      where: category ? { category: category as never } : undefined,
      orderBy: { lastSeenAt: "desc" },
      take: 200,
      select: {
        id: true, source: true, externalRef: true, category: true,
        authorEmail: true, issueKey: true, componentKey: true,
        date: true, hours: true, detail: true, lastSeenAt: true,
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
