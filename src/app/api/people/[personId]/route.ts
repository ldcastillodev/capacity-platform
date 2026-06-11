import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { addUtcDays, toUtcDateOnly } from "@/lib/temporal";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ personId: string }> },
) {
  const { personId } = await params;
  const person = await prisma.person.findUnique({
    where: { id: Number(personId) },
    select: { id: true, name: true, email: true, isActive: true, weeklyCapacityHours: true },
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
    weekly_capacity_hours?: number;
  };

  const person = await prisma.$transaction(async (tx) => {
    const updated = await tx.person.update({
      where: { id: Number(personId) },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.is_active !== undefined && { isActive: body.is_active }),
        ...(body.weekly_capacity_hours !== undefined && { weeklyCapacityHours: body.weekly_capacity_hours }),
      },
      select: { id: true, name: true, email: true, isActive: true, weeklyCapacityHours: true },
    });

    // Capacity changes are versioned: end-date the open history row and start a
    // new one so historical months keep the capacity that was true at the time.
    if (body.weekly_capacity_hours !== undefined) {
      const today = toUtcDateOnly(new Date());
      const open = await tx.personCapacityHistory.findFirst({
        where: { personId: Number(personId), effectiveTo: null },
        orderBy: { effectiveFrom: "desc" },
      });
      if (!open) {
        await tx.personCapacityHistory.create({
          data: {
            personId: Number(personId),
            weeklyCapacityHours: body.weekly_capacity_hours,
            effectiveFrom: today,
          },
        });
      } else if (Number(open.weeklyCapacityHours) !== body.weekly_capacity_hours) {
        if (open.effectiveFrom >= today) {
          // Row already starts today — correct it in place instead of creating
          // an invalid zero-length predecessor.
          await tx.personCapacityHistory.update({
            where: { id: open.id },
            data: { weeklyCapacityHours: body.weekly_capacity_hours },
          });
        } else {
          await tx.personCapacityHistory.update({
            where: { id: open.id },
            data: { effectiveTo: addUtcDays(today, -1) },
          });
          await tx.personCapacityHistory.create({
            data: {
              personId: Number(personId),
              weeklyCapacityHours: body.weekly_capacity_hours,
              effectiveFrom: today,
            },
          });
        }
      }
    }

    return updated;
  });
  return NextResponse.json(person);
}
