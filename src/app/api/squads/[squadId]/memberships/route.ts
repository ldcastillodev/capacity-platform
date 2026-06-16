import { NextRequest, NextResponse } from "next/server";
import { squadService } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ squadId: string }> }) {
  const { squadId } = await params;
  const body = (await req.json()) as {
    person_id: number;
    allocation_pct?: number;
    effective_from: string;
    effective_to?: string;
  };

  try {
    const membership = await squadService.createSquadMembership({
      personId: body.person_id,
      squadId: Number(squadId),
      allocationPct: body.allocation_pct ?? 1.0,
      effectiveFrom: new Date(body.effective_from),
      effectiveTo: body.effective_to ? new Date(body.effective_to) : null,
    });
    return NextResponse.json(membership, { status: 201 });
  } catch (e) {
    if (String(e).includes("exclusion constraint"))
      return NextResponse.json(
        { error: "Overlapping membership for this person/squad date range." },
        { status: 409 }
      );
    if (String(e).includes("allocation_sum_exceeded"))
      return NextResponse.json(
        {
          error: "Total allocation across this person's overlapping memberships would exceed 100%.",
        },
        { status: 409 }
      );
    throw e;
  }
}
