import { NextRequest, NextResponse } from "next/server";
import { personService } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  const { personId } = await params;
  const person = await personService.findPersonSummary(Number(personId));
  if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(person);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  const { personId } = await params;
  const body = (await req.json()) as {
    name?: string;
    email?: string;
    is_active?: boolean;
    weekly_capacity_hours?: number;
  };

  const person = await personService.updatePersonWithCapacityHistory(Number(personId), {
    name: body.name,
    email: body.email,
    isActive: body.is_active,
    weeklyCapacityHours: body.weekly_capacity_hours,
  });
  return NextResponse.json(person);
}
