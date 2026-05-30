import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await req.json() as { hard_buffer_pct?: number; soft_buffer_pct?: number };
    const row = await prisma.squadCapacityConfig.update({
      where: { id: Number(id) },
      data: {
        ...(body.hard_buffer_pct !== undefined && { hardBufferPct: body.hard_buffer_pct }),
        ...(body.soft_buffer_pct !== undefined && { softBufferPct: body.soft_buffer_pct }),
      },
      select: {
        id: true, squadId: true, roleType: true,
        hardBufferPct: true, softBufferPct: true,
        squad: { select: { id: true, name: true } },
      },
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
    await prisma.squadCapacityConfig.delete({ where: { id: Number(id) } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
