import { NextRequest, NextResponse } from "next/server";
import { squadService } from "@/lib/db";

export async function GET() {
  const squads = await squadService.listSquads();
  return NextResponse.json(squads);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { name: string; lead_person_id?: number };
  const squad = await squadService.createSquad({
    name: body.name,
    leadPersonId: body.lead_person_id ?? null,
  });
  return NextResponse.json(squad, { status: 201 });
}
