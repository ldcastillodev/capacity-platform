import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  const persons = await prisma.person.findMany({
    where: includeArchived ? undefined : { isActive: true },
    orderBy: { name: "asc" },
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
  return NextResponse.json(persons);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string;
    email: string;
    employment_type?: string;
    weekly_capacity_hours?: number;
    squad_id?: number | null;
    allocation_pct?: number;
  };

  const person = await prisma.$transaction(async (tx) => {
    const p = await tx.person.create({
      data: {
        name: body.name,
        email: body.email,
        weeklyCapacityHours: body.weekly_capacity_hours ?? 40,
      },
    });

    if (body.squad_id) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await tx.squadMembership.create({
        data: {
          personId: p.id,
          squadId: body.squad_id,
          allocationPct: body.allocation_pct ?? 1.0,
          effectiveFrom: today,
        },
      });
    }

    return tx.person.findUnique({
      where: { id: p.id },
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

  return NextResponse.json(person, { status: 201 });
}
