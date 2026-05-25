import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ squadId: string }> },
) {
  const { squadId } = await params;
  const body = await req.json() as {
    person_id: number;
    allocation_pct?: number;
    effective_from: string;
    effective_to?: string;
  };

  const membership = await prisma.squadMembership.create({
    data: {
      personId: body.person_id,
      squadId: Number(squadId),
      allocationPct: body.allocation_pct ?? 1.0,
      effectiveFrom: new Date(body.effective_from),
      effectiveTo: body.effective_to ? new Date(body.effective_to) : null,
    },
  });
  return NextResponse.json(membership, { status: 201 });
}
