import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await req.json() as {
      seniority?: string | null; is_primary?: boolean; effective_to?: string | null;
    };
    const row = await prisma.personRole.update({
      where: { id: Number(id) },
      data: {
        ...(body.seniority !== undefined && { seniority: body.seniority as never }),
        ...(body.is_primary !== undefined && { isPrimary: body.is_primary }),
        ...(body.effective_to !== undefined && {
          effectiveTo: body.effective_to ? new Date(body.effective_to) : null,
        }),
      },
      select: {
        id: true, personId: true, roleType: true,
        seniority: true, isPrimary: true, effectiveFrom: true, effectiveTo: true,
        person: { select: { id: true, name: true } },
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
    await prisma.personRole.delete({ where: { id: Number(id) } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
