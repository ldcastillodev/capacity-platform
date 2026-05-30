import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const resolved = searchParams.get("resolved");
  try {
    const rows = await prisma.anomalyFlag.findMany({
      where: {
        ...(clientId ? { clientId: Number(clientId) } : {}),
        ...(resolved === "true" ? { resolvedAt: { not: null } } : {}),
        ...(resolved === "false" ? { resolvedAt: null } : {}),
      },
      orderBy: { detectedAt: "desc" },
      take: 500,
      select: {
        id: true, clientId: true, squadId: true, month: true, roleType: true,
        flagType: true, severity: true, explanation: true,
        detectedAt: true, resolvedAt: true, resolvedBy: true, resolutionNotes: true,
        client: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
