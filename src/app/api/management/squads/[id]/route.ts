import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json() as { name?: string; lead_person_id?: number | null };

  const squad = await prisma.squad.update({
    where: { id: Number(id) },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.lead_person_id !== undefined && { leadPersonId: body.lead_person_id }),
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
  return NextResponse.json(squad);
}
