import { NextRequest, NextResponse } from "next/server";
import { squadService, ConflictError } from "@/lib/db";
import { toUtcDateOnly } from "@/lib/temporal";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const squadId = searchParams.get("squadId");
  const personId = searchParams.get("personId");
  try {
    const rows = await squadService.listSquadMemberships({
      squadId: squadId ? Number(squadId) : undefined,
      personId: personId ? Number(personId) : undefined,
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      person_id: number;
      squad_id: number;
      allocation_pct?: number;
      effective_from: string;
    };

    const row = await squadService.createMembershipWithOverlapResolution({
      personId: body.person_id,
      squadId: body.squad_id,
      allocationPct: body.allocation_pct ?? 1.0,
      effectiveFrom: toUtcDateOnly(body.effective_from),
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof ConflictError) return NextResponse.json({ error: e.message }, { status: 409 });
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
    if ((e as { code?: string })?.code === "P2002")
      return NextResponse.json(
        { error: "Duplicate membership for this person/squad/date." },
        { status: 400 }
      );
    if ((e as { code?: string })?.code === "P2003")
      return NextResponse.json(
        { error: "The selected person or squad no longer exists. Refresh and try again." },
        { status: 400 }
      );
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
