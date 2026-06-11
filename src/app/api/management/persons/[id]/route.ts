import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { addUtcDays, toUtcDateOnly } from "@/lib/temporal";

class ConflictError extends Error {}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const personId = Number(id);

  const body = await req.json() as {
    name?: string;
    email?: string;
    employment_type?: string;
    weekly_capacity_hours?: number;
    squad_id?: number | null;
    allocation_pct?: number;
  };

  try {
  const person = await prisma.$transaction(async (tx) => {
    await tx.person.update({
      where: { id: personId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.weekly_capacity_hours !== undefined && { weeklyCapacityHours: body.weekly_capacity_hours }),
      },
    });

    // Capacity changes are versioned: end-date the open history row and start a
    // new one so historical months keep the capacity that was true at the time.
    if (body.weekly_capacity_hours !== undefined) {
      const today = toUtcDateOnly(new Date());
      const open = await tx.personCapacityHistory.findFirst({
        where: { personId, effectiveTo: null },
        orderBy: { effectiveFrom: "desc" },
      });
      if (!open) {
        await tx.personCapacityHistory.create({
          data: {
            personId,
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
              personId,
              weeklyCapacityHours: body.weekly_capacity_hours,
              effectiveFrom: today,
            },
          });
        }
      }
    }

    if (body.squad_id !== undefined) {
      const today = toUtcDateOnly(new Date());
      // Close prior rows at yesterday so the old and new memberships never
      // overlap on the transition day.
      const yesterday = addUtcDays(today, -1);

      const openRows = await tx.squadMembership.findMany({
        where: { personId, effectiveTo: null },
        select: { id: true, effectiveFrom: true },
      });
      for (const prior of openRows) {
        if (prior.effectiveFrom >= today) {
          throw new ConflictError(
            "Person already has a membership starting today; cannot end-date it to yesterday.",
          );
        }
        await tx.squadMembership.update({
          where: { id: prior.id },
          data: { effectiveTo: yesterday },
        });
      }

      if (body.squad_id !== null) {
        await tx.squadMembership.create({
          data: {
            personId,
            squadId: body.squad_id,
            allocationPct: body.allocation_pct ?? 1.0,
            effectiveFrom: today,
          },
        });
      }
    }

    return tx.person.findUnique({
      where: { id: personId },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        weeklyCapacityHours: true,
        squadMemberships: {
          where: { effectiveTo: null },
          select: {
            id: true,
            squadId: true,
            allocationPct: true,
            effectiveFrom: true,
            squad: { select: { id: true, name: true } },
          },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
        },
      },
    });
  });

  return NextResponse.json(person);
  } catch (e) {
    if (e instanceof ConflictError)
      return NextResponse.json({ error: e.message }, { status: 409 });
    if (String(e).includes("allocation_sum_exceeded"))
      return NextResponse.json({ error: "Total allocation across this person's overlapping memberships would exceed 100%." }, { status: 409 });
    throw e;
  }
}
