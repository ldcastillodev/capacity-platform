import { NextRequest, NextResponse } from "next/server";
import { squadService } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  const squads = await squadService.listManagedSquads({ includeArchived });
  return NextResponse.json(squads);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { name: string; lead_person_id?: number | null };

  const squad = await squadService.createManagedSquad({
    name: body.name,
    leadPersonId: body.lead_person_id ?? null,
  });
  return NextResponse.json(squad, { status: 201 });
}
