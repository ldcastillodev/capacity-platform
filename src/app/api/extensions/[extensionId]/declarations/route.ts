import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ extensionId: string }> },
) {
  const { extensionId } = await params;
  const decls = await prisma.monthlyRoleDeclaration.findMany({
    where: { extensionId: Number(extensionId) },
    orderBy: { roleType: "asc" },
  });
  return NextResponse.json(decls);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ extensionId: string }> },
) {
  const { extensionId } = await params;
  const body = await req.json() as { role_type: string; declared_hours: number };

  const ext = await prisma.contractExtension.findUnique({
    where: { id: Number(extensionId) },
  });
  if (!ext) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const squad = await prisma.client.findFirst({
    where: { id: ext.clientId },
    select: {
      retainerContracts: {
        where: { status: "active" },
        select: { squadId: true },
        take: 1,
      },
    },
  });
  const squadId = squad?.retainerContracts[0]?.squadId ?? 0;

  const decl = await prisma.monthlyRoleDeclaration.create({
    data: {
      extensionId: Number(extensionId),
      clientId: ext.clientId,
      squadId,
      month: ext.month,
      roleType: body.role_type as never,
      declaredHours: body.declared_hours,
      status: "confirmed",
    },
  });
  return NextResponse.json(decl, { status: 201 });
}
