import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { RoleType } from "@prisma/client";

const EDITABLE = ["draft", "confirmed"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const decl = await prisma.monthlyRoleDeclaration.findUnique({ where: { id: Number(id) } });
    if (!decl) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!(EDITABLE as readonly string[]).includes(decl.status))
      return NextResponse.json({ error: "Declaration is locked and cannot be edited." }, { status: 400 });

    const body = await req.json() as {
      roles?: Array<{ role_type: string; declared_hours: number }>;
    };

    if (body.roles && Array.isArray(body.roles)) {
      await prisma.$transaction(
        body.roles.map((r) =>
          prisma.declarationRoleEntry.upsert({
            where: { declarationId_roleType: { declarationId: Number(id), roleType: r.role_type as RoleType } },
            update: { declaredHours: r.declared_hours },
            create: { declarationId: Number(id), roleType: r.role_type as RoleType, declaredHours: r.declared_hours },
          }),
        ),
      );
    }

    const row = await prisma.monthlyRoleDeclaration.findUnique({
      where: { id: Number(id) },
      select: {
        id: true, clientId: true, squadId: true, month: true,
        status: true, updatedAt: true,
        roles: { select: { id: true, roleType: true, declaredHours: true } },
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
