import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const EDITABLE = ["draft", "confirmed"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const decl = await prisma.monthlyRoleDeclaration.findUnique({ where: { id: Number(id) } });
    if (!decl) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!EDITABLE.includes(decl.status))
      return NextResponse.json({ error: "Declaration is locked and cannot be edited." }, { status: 400 });

    const body = await req.json() as { declared_hours?: number; override_reason?: string; override_by?: number };
    const row = await prisma.monthlyRoleDeclaration.update({
      where: { id: Number(id) },
      data: {
        ...(body.declared_hours !== undefined && { declaredHours: body.declared_hours }),
        ...(body.override_reason !== undefined && { overrideReason: body.override_reason }),
        ...(body.override_by !== undefined && { overrideBy: body.override_by }),
      },
      select: {
        id: true, clientId: true, squadId: true, month: true,
        roleType: true, declaredHours: true, status: true, updatedAt: true,
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
