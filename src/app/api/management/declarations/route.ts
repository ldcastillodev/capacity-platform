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
      orderBy: [{ month: "desc" }, { roleType: "asc" }],
      select: {
        id: true, contractId: true, clientId: true, squadId: true,
        month: true, roleType: true, declaredHours: true, status: true,
        submittedAt: true, submittedBy: true, updatedAt: true,
        client: { select: { id: true, name: true } },
        squad: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      contract_id?: number;
      client_id: number; squad_id: number; month: string;
      role_type: string; declared_hours: number;
    };
    const row = await prisma.monthlyRoleDeclaration.create({
      data: {
        contractId: body.contract_id ?? null,
        clientId: body.client_id, squadId: body.squad_id,
        month: new Date(body.month),
        roleType: body.role_type as never,
        declaredHours: body.declared_hours,
      },
      select: {
        id: true, contractId: true, clientId: true, squadId: true,
        month: true, roleType: true, declaredHours: true, status: true, updatedAt: true,
        client: { select: { id: true, name: true } },
        squad: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
