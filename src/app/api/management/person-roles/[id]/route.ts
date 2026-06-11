import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { addUtcDays, toUtcDateOnly } from "@/lib/temporal";

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
        ...(body.effective_to !== undefined && {
          effectiveTo: body.effective_to ? new Date(body.effective_to) : null,
        }),
      },
      select: {
        id: true, personId: true, roleType: true,
        seniority: true, effectiveFrom: true, effectiveTo: true,
        person: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    if (String(e).includes("exclusion constraint"))
      return NextResponse.json({ error: "Overlapping role for this person's date range." }, { status: 409 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const row = await prisma.personRole.findUnique({ where: { id: Number(id) } });
    if (!row) {
      return NextResponse.json({ error: "Role not found." }, { status: 404 });
    }

    // HourRecords synced inside this row's effective window depend on it for
    // temporal history — refuse to destroy it.
    const dependentHours = await prisma.hourRecord.count({
      where: {
        personId: row.personId,
        roleType: row.roleType,
        date: {
          gte: row.effectiveFrom,
          ...(row.effectiveTo ? { lte: row.effectiveTo } : {}),
        },
      },
    });
    if (dependentHours > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete: ${dependentHours} hour record(s) were attributed through this role's effective window. End-date the role instead.`,
        },
        { status: 409 },
      );
    }

    const yesterday = addUtcDays(toUtcDateOnly(new Date()), -1);
    if (row.effectiveTo === null && row.effectiveFrom <= yesterday) {
      const updated = await prisma.personRole.update({
        where: { id: row.id },
        data: { effectiveTo: yesterday },
      });
      return NextResponse.json({ deleted: false, endDated: true, effectiveTo: updated.effectiveTo });
    }

    // Already end-dated (or created today) with no dependent hours — safe to remove.
    await prisma.personRole.delete({ where: { id: row.id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
