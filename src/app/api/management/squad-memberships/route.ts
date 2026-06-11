import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { addUtcDays, toUtcDateOnly } from "@/lib/temporal";

class ConflictError extends Error {}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const squadId = searchParams.get("squadId");
  const personId = searchParams.get("personId");
  try {
    const rows = await prisma.squadMembership.findMany({
      where: {
        ...(squadId ? { squadId: Number(squadId) } : {}),
        ...(personId ? { personId: Number(personId) } : {}),
      },
      orderBy: { effectiveFrom: "desc" },
      select: {
        id: true, personId: true, squadId: true,
        allocationPct: true, effectiveFrom: true, effectiveTo: true,
        person: { select: { id: true, name: true } },
        squad: { select: { id: true, name: true } },
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
      person_id: number; squad_id: number;
      allocation_pct?: number; effective_from: string;
    };
    const effectiveFrom = toUtcDateOnly(body.effective_from);
    const allocationPct = body.allocation_pct ?? 1.0;
    const priorEnd = addUtcDays(effectiveFrom, -1);

    const row = await prisma.$transaction(async (tx) => {
      const openRows = await tx.squadMembership.findMany({
        where: { personId: body.person_id, effectiveTo: null },
      });
      // Close prior open rows: always for the same squad; for other squads only
      // on a full move (allocation 1.0) — partial allocations are intentional splits.
      const toClose = openRows.filter(
        r => r.squadId === body.squad_id || allocationPct >= 1.0,
      );
      for (const prior of toClose) {
        if (prior.effectiveFrom >= effectiveFrom) {
          throw new ConflictError(
            `Person already has a membership starting ${prior.effectiveFrom.toISOString().slice(0, 10)} that overlaps the new effective_from.`,
          );
        }
        await tx.squadMembership.update({
          where: { id: prior.id },
          data: { effectiveTo: priorEnd },
        });
      }
      return tx.squadMembership.create({
        data: {
          personId: body.person_id, squadId: body.squad_id,
          allocationPct,
          effectiveFrom,
        },
        select: {
          id: true, personId: true, squadId: true,
          allocationPct: true, effectiveFrom: true, effectiveTo: true,
          person: { select: { id: true, name: true } },
          squad: { select: { id: true, name: true } },
        },
      });
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof ConflictError)
      return NextResponse.json({ error: e.message }, { status: 409 });
    if (String(e).includes("exclusion constraint"))
      return NextResponse.json({ error: "Overlapping membership for this person/squad date range." }, { status: 409 });
    if (String(e).includes("allocation_sum_exceeded"))
      return NextResponse.json({ error: "Total allocation across this person's overlapping memberships would exceed 100%." }, { status: 409 });
    if ((e as { code?: string })?.code === "P2002")
      return NextResponse.json({ error: "Duplicate membership for this person/squad/date." }, { status: 400 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
