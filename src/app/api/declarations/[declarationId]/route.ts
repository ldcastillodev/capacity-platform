import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ declarationId: string }> },
) {
  const { declarationId } = await params;
  const body = await req.json() as { declared_hours: number };

  const decl = await prisma.monthlyRoleDeclaration.findUnique({
    where: { id: Number(declarationId) },
  });
  if (!decl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (decl.status === "locked") {
    return NextResponse.json({ error: "Declaration is locked" }, { status: 409 });
  }

  const updated = await prisma.monthlyRoleDeclaration.update({
    where: { id: Number(declarationId) },
    data: { declaredHours: body.declared_hours },
  });
  return NextResponse.json(updated);
}
