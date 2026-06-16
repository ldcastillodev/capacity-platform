import { NextRequest, NextResponse } from "next/server";
import { declarationService } from "@/lib/db";
import type { RoleType } from "@prisma/client";

const EDITABLE = ["draft", "confirmed"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const decl = await declarationService.findDeclarationById(Number(id));
    if (!decl) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!(EDITABLE as readonly string[]).includes(decl.status))
      return NextResponse.json(
        { error: "Declaration is locked and cannot be edited." },
        { status: 400 }
      );

    const body = (await req.json()) as {
      roles?: Array<{ role_type: string; declared_hours: number }>;
    };

    if (body.roles && Array.isArray(body.roles)) {
      await declarationService.upsertDeclarationRoles(
        Number(id),
        body.roles.map((r) => ({
          roleType: r.role_type as RoleType,
          declaredHours: r.declared_hours,
        }))
      );
    }

    const row = await declarationService.findDeclarationWithRoles(Number(id));
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
