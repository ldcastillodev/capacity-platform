import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { addUtcDays, toUtcDateOnly } from "@/lib/temporal";

class ConflictError extends Error {}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ personId: string }> },
) {
  const { personId } = await params;
  const body = await req.json() as {
    role_type: string;
    seniority?: string;
    is_primary?: boolean;
    effective_from: string;
    effective_to?: string;
  };

  const effectiveFrom = toUtcDateOnly(body.effective_from);
  const priorEnd = addUtcDays(effectiveFrom, -1);

  try {
    const role = await prisma.$transaction(async (tx) => {
      const openRows = await tx.personRole.findMany({
        where: { personId: Number(personId), effectiveTo: null },
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
          personId: Number(personId),
          roleType: body.role_type as never,
          seniority: (body.seniority as never) ?? null,
          effectiveFrom,
          effectiveTo: body.effective_to ? toUtcDateOnly(body.effective_to) : null,
        },
      });
    });
    return NextResponse.json(role, { status: 201 });
  } catch (e) {
    if (e instanceof ConflictError)
      return NextResponse.json({ error: e.message }, { status: 409 });
    if (String(e).includes("exclusion constraint"))
      return NextResponse.json({ error: "Overlapping role for this person's date range." }, { status: 409 });
    throw e;
  }
}
