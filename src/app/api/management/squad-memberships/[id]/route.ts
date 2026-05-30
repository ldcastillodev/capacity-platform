import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await req.json() as { allocation_pct?: number; effective_to?: string | null };
    const row = await prisma.squadMembership.update({
      where: { id: Number(id) },
      data: {
        ...(body.allocation_pct !== undefined && { allocationPct: body.allocation_pct }),
        ...(body.effective_to !== undefined && {
          effectiveTo: body.effective_to ? new Date(body.effective_to) : null,
        }),
      },
      select: {
        id: true, personId: true, squadId: true,
        allocationPct: true, effectiveFrom: true, effectiveTo: true,
        person: { select: { id: true, name: true } },
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
    await prisma.squadMembership.delete({ where: { id: Number(id) } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
