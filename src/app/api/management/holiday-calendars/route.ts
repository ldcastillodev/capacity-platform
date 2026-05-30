import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  try {
    const rows = await prisma.holidayCalendar.findMany({
      orderBy: [{ region: "asc" }, { name: "asc" }],
      select: {
        id: true, region: true, name: true,
        _count: { select: { entries: true, personAssignments: true } },
      },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { region: string; name: string };
    const row = await prisma.holidayCalendar.create({
      data: { region: body.region, name: body.name },
      select: { id: true, region: true, name: true, _count: { select: { entries: true } } },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002")
      return NextResponse.json({ error: "Calendar already exists for this region/name." }, { status: 400 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
