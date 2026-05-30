import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("personId");
  try {
    const rows = await prisma.personCalendarAssignment.findMany({
      where: personId ? { personId: Number(personId) } : undefined,
      orderBy: { effectiveFrom: "desc" },
      select: {
        id: true, personId: true, calendarId: true, effectiveFrom: true, effectiveTo: true,
        person: { select: { id: true, name: true } },
        calendar: { select: { id: true, name: true, region: true } },
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
      person_id: number; calendar_id: number; effective_from: string; effective_to?: string;
    };

    // Guard: only one open-ended assignment per person (partial unique index)
    if (!body.effective_to) {
      const existing = await prisma.personCalendarAssignment.findFirst({
        where: { personId: body.person_id, effectiveTo: null },
      });
      if (existing)
        return NextResponse.json(
          { error: "Person already has an open-ended calendar assignment. Set effectiveTo on the existing one first." },
          { status: 400 },
        );
    }

    const row = await prisma.personCalendarAssignment.create({
      data: {
        personId: body.person_id, calendarId: body.calendar_id,
        effectiveFrom: new Date(body.effective_from),
        effectiveTo: body.effective_to ? new Date(body.effective_to) : null,
      },
      select: {
        id: true, personId: true, calendarId: true, effectiveFrom: true, effectiveTo: true,
        person: { select: { id: true, name: true } },
        calendar: { select: { id: true, name: true, region: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002")
      return NextResponse.json({ error: "Assignment already exists for this person/date." }, { status: 400 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
