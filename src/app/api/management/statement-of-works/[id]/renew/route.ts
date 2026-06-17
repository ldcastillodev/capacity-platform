import { NextRequest, NextResponse } from "next/server";
import { contractService, ConflictError } from "@/lib/db";
import { toUtcDateOnly } from "@/lib/temporal";

// BR-7: renewal creates a NEW SOW (linked via parentSowId) with new child
// contracts (linked via parentContractId) and re-pointed component mappings.
// The old SOW is deactivated (isActive=false) but retained as a historical
// record; its contracts are closed and their open mappings end-dated at the
// renewal boundary, so backdated worklogs still route to the old contracts and
// new worklogs to the new ones.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const body = (await req.json()) as {
    name?: string;
    start_date: string;
    end_date?: string;
    contracts: Array<{ id: number; assigned_hours: number }>;
  };

  if (!body.start_date || !Array.isArray(body.contracts)) {
    return NextResponse.json({ error: "start_date and contracts are required." }, { status: 400 });
  }

  try {
    const result = await contractService.renewStatementOfWork(Number(id), {
      name: body.name,
      startDate: toUtcDateOnly(body.start_date),
      endDate: body.end_date ? toUtcDateOnly(body.end_date) : null,
      contracts: body.contracts.map((c) => ({ id: c.id, assignedHours: c.assigned_hours })),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof ConflictError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
