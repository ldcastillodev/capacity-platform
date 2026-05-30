import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const declarationId = searchParams.get("declarationId");
  try {
    const rows = await prisma.monthlyRoleDeclarationHistory.findMany({
      where: declarationId ? { declarationId: Number(declarationId) } : undefined,
      orderBy: { changedAt: "desc" },
      take: 500,
      select: {
        id: true, declarationId: true, changedAt: true, changedBy: true,
        prevDeclaredHours: true, newDeclaredHours: true,
        prevStatus: true, newStatus: true, reason: true,
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
