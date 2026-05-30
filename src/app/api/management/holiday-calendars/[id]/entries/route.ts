import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const rows = await prisma.holidayEntry.findMany({
      where: { calendarId: Number(id) },
      orderBy: { date: "asc" },
      select: { id: true, calendarId: true, date: true, name: true },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await req.json() as { date: string; name: string };
    const row = await prisma.holidayEntry.create({
      data: { calendarId: Number(id), date: new Date(body.date), name: body.name },
      select: { id: true, calendarId: true, date: true, name: true },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002")
      return NextResponse.json({ error: "Holiday already exists for this date." }, { status: 400 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
