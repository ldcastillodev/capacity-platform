import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const month = searchParams.get("month");
  try {
    const rows = await prisma.ceremonyAttribution.findMany({
      where: {
        ...(clientId ? { clientId: Number(clientId) } : {}),
        ...(month ? { month: new Date(month) } : {}),
      },
      orderBy: [{ month: "desc" }, { clientId: "asc" }],
      take: 500,
      select: {
        id: true, squadId: true, clientId: true, month: true,
        squadTotalCeremonyHours: true, attributedHours: true,
        attributionFraction: true, calculatedAt: true,
        squad: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
