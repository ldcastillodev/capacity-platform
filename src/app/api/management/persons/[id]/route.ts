import { NextRequest, NextResponse } from "next/server";
import { personService, ConflictError } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const body = (await req.json()) as {
    name?: string;
    email?: string;
    employment_type?: string;
    weekly_capacity_hours?: number;
    squad_id?: number | null;
    allocation_pct?: number;
  };

  try {
    const person = await personService.updatePersonWithCapacityAndMembership(Number(id), {
      name: body.name,
      email: body.email,
      weeklyCapacityHours: body.weekly_capacity_hours,
      squadId: body.squad_id,
      allocationPct: body.allocation_pct,
    });
    return NextResponse.json(person);
  } catch (e) {
    if (e instanceof ConflictError) return NextResponse.json({ error: e.message }, { status: 409 });
    if (String(e).includes("allocation_sum_exceeded"))
      return NextResponse.json(
        {
          error: "Total allocation across this person's overlapping memberships would exceed 100%.",
        },
        { status: 409 }
      );
    throw e;
  }
}
