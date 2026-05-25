import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ personId: string }> },
) {
  const { personId } = await params;
  const person = await prisma.person.findUnique({
    where: { id: Number(personId) },
    select: { id: true, name: true, email: true, isActive: true, weeklyCapacityHours: true, costPerHour: true, tempoAccountId: true },
  });
  if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(person);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ personId: string }> },
) {
  const { personId } = await params;
  const body = await req.json() as {
    name?: string;
    email?: string;
    is_active?: boolean;
    tempo_account_id?: string;
    cost_per_hour?: number;
    weekly_capacity_hours?: number;
  };

  const person = await prisma.person.update({
    where: { id: Number(personId) },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.is_active !== undefined && { isActive: body.is_active }),
      ...(body.tempo_account_id !== undefined && { tempoAccountId: body.tempo_account_id }),
      ...(body.cost_per_hour !== undefined && { costPerHour: body.cost_per_hour }),
      ...(body.weekly_capacity_hours !== undefined && { weeklyCapacityHours: body.weekly_capacity_hours }),
    },
    select: { id: true, name: true, email: true, isActive: true, weeklyCapacityHours: true, costPerHour: true, tempoAccountId: true },
  });
  return NextResponse.json(person);
}
