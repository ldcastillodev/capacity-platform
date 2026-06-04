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
    squad_id?: number | null;
    allocation_pct?: number;
  };

  const person = await prisma.$transaction(async (tx) => {
    await tx.person.update({
      where: { id: personId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.weekly_capacity_hours !== undefined && { weeklyCapacityHours: body.weekly_capacity_hours }),
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
}
