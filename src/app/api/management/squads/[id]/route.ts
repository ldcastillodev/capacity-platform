import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const squadId = Number(id);
  const body = await req.json() as { name?: string; lead_person_id?: number | null };

  // Guard: lead must have an active SquadMembership for this squad
  if (body.lead_person_id != null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const membership = await prisma.squadMembership.findFirst({
      where: {
        squadId,
        personId: body.lead_person_id,
        effectiveFrom: { lte: today },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
      },
    });
    if (!membership) {
      return NextResponse.json(
        { error: "lead_person_id must be an active member of the squad" },
        { status: 400 },
      );
    }
  }

  const squad = await prisma.squad.update({
    where: { id: squadId },
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
