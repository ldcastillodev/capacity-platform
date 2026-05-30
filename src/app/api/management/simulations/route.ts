import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  try {
    const rows = await prisma.clientSimulation.findMany({
      where: clientId ? { clientId: Number(clientId) } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, clientId: true, name: true, proposedClientName: true,
        proposedStartMonth: true, proposedPoolHours: true,
        feasible: true, bottleneckRole: true, createdAt: true,
        _count: { select: { lineItems: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
