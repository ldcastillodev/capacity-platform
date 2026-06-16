import { NextRequest, NextResponse } from "next/server";
import { personService, ConflictError } from "@/lib/db";
import type { RoleType, Seniority } from "@prisma/client";
import { toUtcDateOnly } from "@/lib/temporal";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  const { personId } = await params;
  const body = (await req.json()) as {
    role_type: string;
    seniority?: string;
    is_primary?: boolean;
    effective_from: string;
    effective_to?: string;
  };

  try {
    const role = await personService.createPersonRoleWithOverlapResolution({
      personId: Number(personId),
      roleType: body.role_type as RoleType,
      seniority: (body.seniority as Seniority) ?? null,
      effectiveFrom: toUtcDateOnly(body.effective_from),
      effectiveTo: body.effective_to ? toUtcDateOnly(body.effective_to) : null,
    });
    return NextResponse.json(role, { status: 201 });
  } catch (e) {
    if (e instanceof ConflictError) return NextResponse.json({ error: e.message }, { status: 409 });
    if (String(e).includes("exclusion constraint"))
      return NextResponse.json(
        { error: "Overlapping role for this person's date range." },
        { status: 409 }
      );
    throw e;
  }
}
