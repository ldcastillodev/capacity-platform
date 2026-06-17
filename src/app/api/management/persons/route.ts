import { NextRequest, NextResponse } from "next/server";
import { personService } from "@/lib/db";
import { toUtcDateOnly } from "@/lib/temporal";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  const persons = await personService.listManagedPersons({ includeArchived });
  return NextResponse.json(persons);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name: string;
    email: string;
    employment_type?: string;
    weekly_capacity_hours?: number;
    squad_id?: number | null;
    allocation_pct?: number;
    effective_from?: string;
  };

  const person = await personService.createPersonWithOptionalMembership({
    name: body.name,
    email: body.email,
    weeklyCapacityHours: body.weekly_capacity_hours,
    squadId: body.squad_id,
    allocationPct: body.allocation_pct,
    membershipEffectiveFrom: body.effective_from ? toUtcDateOnly(body.effective_from) : undefined,
  });

  return NextResponse.json(person, { status: 201 });
}
