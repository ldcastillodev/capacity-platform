import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const squads = await prisma.squad.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, leadPersonId: true },
  });
  return NextResponse.json(squads);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { name: string; lead_person_id?: number };
  const squad = await prisma.squad.create({
    data: { name: body.name, leadPersonId: body.lead_person_id ?? null },
    select: { id: true, name: true, leadPersonId: true },
  });
  return NextResponse.json(squad, { status: 201 });
}
