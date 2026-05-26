import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
    tempo_account_id?: string | null;
    cost_per_hour?: number | null;
    squad_id?: number | null;
    allocation_pct?: number;
  };

  const person = await prisma.$transaction(async (tx) => {
    await tx.person.update({
      where: { id: personId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.employment_type !== undefined && { employmentType: body.employment_type as never }),
        ...(body.weekly_capacity_hours !== undefined && { weeklyCapacityHours: body.weekly_capacity_hours }),
        ...(body.tempo_account_id !== undefined && { tempoAccountId: body.tempo_account_id }),
        ...(body.cost_per_hour !== undefined && { costPerHour: body.cost_per_hour }),
      },
    });

    if (body.squad_id !== undefined) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await tx.squadMembership.updateMany({
        where: { personId, effectiveTo: null },
        data: { effectiveTo: today },
      });

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
        employmentType: true,
        weeklyCapacityHours: true,
        tempoAccountId: true,
        costPerHour: true,
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
}
