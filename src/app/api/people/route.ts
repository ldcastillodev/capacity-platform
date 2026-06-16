import { NextRequest, NextResponse } from "next/server";
import { personService } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isActive = searchParams.get("is_active");

  const people = await personService.listPersons({
    isActive: isActive !== null ? isActive === "true" : undefined,
  });
  return NextResponse.json(people);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name: string;
    email: string;
    employment_type?: string;
    weekly_capacity_hours?: number;
  };

  const person = await personService.createPerson({
    name: body.name,
    email: body.email,
    weeklyCapacityHours: body.weekly_capacity_hours ?? 40,
  });
  return NextResponse.json(person, { status: 201 });
}
