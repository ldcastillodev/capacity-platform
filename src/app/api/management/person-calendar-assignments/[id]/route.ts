import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await req.json() as { effective_to?: string | null };
    const row = await prisma.personCalendarAssignment.update({
      where: { id: Number(id) },
      data: {
        ...(body.effective_to !== undefined && {
          effectiveTo: body.effective_to ? new Date(body.effective_to) : null,
        }),
      },
      select: { id: true, personId: true, calendarId: true, effectiveFrom: true, effectiveTo: true },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await prisma.personCalendarAssignment.delete({ where: { id: Number(id) } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
