import { NextRequest, NextResponse } from "next/server";
import { personService, ConflictError } from "@/lib/db";
import type { RoleType, Seniority } from "@prisma/client";
import { toUtcDateOnly } from "@/lib/temporal";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("personId");
  try {
    const rows = await personService.listPersonRoles({
      personId: personId ? Number(personId) : undefined,
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      person_id: number;
      role_type: string;
      seniority?: string;
      is_primary?: boolean;
      effective_from: string;
    };

    if (!body.seniority) {
      return NextResponse.json({ error: "Seniority is required." }, { status: 400 });
    }

    const row = await personService.createManagedPersonRoleWithOverlapResolution({
      personId: body.person_id,
      roleType: body.role_type as RoleType,
      seniority: body.seniority as Seniority,
      effectiveFrom: toUtcDateOnly(body.effective_from),
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    if (e instanceof ConflictError) return NextResponse.json({ error: e.message }, { status: 409 });
    if (String(e).includes("exclusion constraint"))
      return NextResponse.json(
        { error: "Overlapping role for this person's date range." },
        { status: 409 }
      );
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
