import { NextRequest, NextResponse } from "next/server";
import { squadService } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const squadId = Number(id);
  const body = (await req.json()) as { name?: string; lead_person_id?: number | null };

  // Guard: lead must have an active SquadMembership for this squad
  if (body.lead_person_id != null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const membership = await squadService.findActiveMembership(squadId, body.lead_person_id, today);
    if (!membership) {
      return NextResponse.json(
        { error: "lead_person_id must be an active member of the squad" },
        { status: 400 }
      );
    }
  }

  const squad = await squadService.updateSquad(squadId, {
    ...(body.name !== undefined && { name: body.name }),
    ...(body.lead_person_id !== undefined && { leadPersonId: body.lead_person_id }),
  });
  return NextResponse.json(squad);
}
