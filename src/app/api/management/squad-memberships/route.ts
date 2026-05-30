import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const squadId = searchParams.get("squadId");
  const personId = searchParams.get("personId");
  try {
    const rows = await prisma.squadMembership.findMany({
      where: {
        ...(squadId ? { squadId: Number(squadId) } : {}),
        ...(personId ? { personId: Number(personId) } : {}),
      },
      orderBy: { effectiveFrom: "desc" },
      select: {
        id: true, personId: true, squadId: true,
        allocationPct: true, effectiveFrom: true, effectiveTo: true,
        person: { select: { id: true, name: true } },
        squad: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      person_id: number; squad_id: number;
      allocation_pct?: number; effective_from: string;
    };
    const row = await prisma.squadMembership.create({
      data: {
        personId: body.person_id, squadId: body.squad_id,
        allocationPct: body.allocation_pct ?? 1.0,
        effectiveFrom: new Date(body.effective_from),
      },
      select: {
        id: true, personId: true, squadId: true,
        allocationPct: true, effectiveFrom: true, effectiveTo: true,
        person: { select: { id: true, name: true } },
        squad: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002")
      return NextResponse.json({ error: "Duplicate membership for this person/squad/date." }, { status: 400 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
