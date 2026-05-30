import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const month = searchParams.get("month");
  try {
    const rows = await prisma.nonBillableEnhancementSuggestion.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(month ? { month: new Date(month) } : {}),
      },
      orderBy: { detectedAt: "desc" },
      take: 500,
      select: {
        id: true, personId: true, squadId: true, month: true,
        suggestionType: true, status: true, explanation: true,
        suggestedAction: true, suggestedHours: true, currentHours: true,
        detectedAt: true, resolvedAt: true, resolvedBy: true,
        person: { select: { id: true, name: true } },
        squad: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
