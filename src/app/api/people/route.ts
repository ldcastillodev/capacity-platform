import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isActive = searchParams.get("is_active");

  const people = await prisma.person.findMany({
    where: isActive !== null ? { isActive: isActive === "true" } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, isActive: true, weeklyCapacityHours: true, tempoAccountId: true },
  });
  return NextResponse.json(people);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string;
    email: string;
    employment_type?: string;
    weekly_capacity_hours?: number;
    tempo_account_id?: string;
  };

  const person = await prisma.person.create({
    data: {
      name: body.name,
      email: body.email,
      employmentType: (body.employment_type as never) ?? "dedicated",
      weeklyCapacityHours: body.weekly_capacity_hours ?? 40,
      tempoAccountId: body.tempo_account_id ?? null,
    },
    select: { id: true, name: true, email: true, isActive: true, weeklyCapacityHours: true },
  });
  return NextResponse.json(person, { status: 201 });
}
