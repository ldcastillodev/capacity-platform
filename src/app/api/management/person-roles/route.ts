import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { addUtcDays, toUtcDateOnly } from "@/lib/temporal";

class ConflictError extends Error {}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("personId");
  try {
    const rows = await prisma.personRole.findMany({
      where: personId ? { personId: Number(personId) } : undefined,
      orderBy: { effectiveFrom: "desc" },
      select: {
        id: true, personId: true, roleType: true,
        seniority: true, effectiveFrom: true, effectiveTo: true,
        person: { select: { id: true, name: true } },
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
      person_id: number; role_type: string; seniority?: string;
      is_primary?: boolean; effective_from: string;
    };
    const effectiveFrom = toUtcDateOnly(body.effective_from);
    const priorEnd = addUtcDays(effectiveFrom, -1);

    const row = await prisma.$transaction(async (tx) => {
      const openRows = await tx.personRole.findMany({
        where: { personId: body.person_id, effectiveTo: null },
      });
      for (const prior of openRows) {
        if (prior.effectiveFrom >= effectiveFrom) {
          throw new ConflictError(
            `Person already has a role starting ${prior.effectiveFrom.toISOString().slice(0, 10)} that overlaps the new effective_from.`,
          );
        }
        await tx.personRole.update({
          where: { id: prior.id },
          data: { effectiveTo: priorEnd },
        });
      }
      return tx.personRole.create({
        data: {
          personId: body.person_id,
          roleType: body.role_type as never,
          seniority: body.seniority as never ?? null,
          effectiveFrom,
        },
        select: {
          id: true, personId: true, roleType: true,
          seniority: true, effectiveFrom: true, effectiveTo: true,
          person: { select: { id: true, name: true } },
        },
      });
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    if (e instanceof ConflictError)
      return NextResponse.json({ error: e.message }, { status: 409 });
    if (String(e).includes("exclusion constraint"))
      return NextResponse.json({ error: "Overlapping role for this person's date range." }, { status: 409 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
