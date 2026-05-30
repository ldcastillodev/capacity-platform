import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const contractId = searchParams.get("contractId");
  try {
    const rows = await prisma.contractAmendment.findMany({
      where: contractId ? { contractId: Number(contractId) } : undefined,
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true, contractId: true, effectiveFrom: true,
        prevPoolHours: true, newPoolHours: true, reason: true, changedBy: true, createdAt: true,
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
