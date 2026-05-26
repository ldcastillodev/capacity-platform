import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  const squads = await prisma.squad.findMany({
    where: includeArchived ? undefined : { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      isActive: true,
      leadPersonId: true,
      lead: { select: { id: true, name: true } },
      members: {
        where: { effectiveTo: null },
        select: { id: true },
      },
    },
  });
  return NextResponse.json(squads);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { name: string; lead_person_id?: number | null };

  const squad = await prisma.squad.create({
    data: {
      name: body.name,
      leadPersonId: body.lead_person_id ?? null,
    },
    select: {
      id: true,
      name: true,
      isActive: true,
      leadPersonId: true,
      lead: { select: { id: true, name: true } },
      members: { where: { effectiveTo: null }, select: { id: true } },
    },
  });
  return NextResponse.json(squad, { status: 201 });
}
