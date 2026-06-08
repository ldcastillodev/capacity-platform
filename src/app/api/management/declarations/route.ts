import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const month = searchParams.get("month");
  try {
    const rows = await prisma.monthlyRoleDeclaration.findMany({
      where: {
        ...(clientId ? { clientId: Number(clientId) } : {}),
        ...(month ? { month: new Date(month) } : {}),
      },
      orderBy: [{ month: "desc" }],
      select: {
        id: true,
        contractId: true,
        clientId: true,
        squadId: true,
        month: true,
        status: true,
        updatedAt: true,
        client: { select: { id: true, name: true } },
        squad: { select: { id: true, name: true } },
        contract: { select: { id: true, name: true } },
        roles: { select: { id: true, roleType: true, declaredHours: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
