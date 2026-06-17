import { NextRequest, NextResponse } from "next/server";
import { contractService } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sowId = searchParams.get("sowId");
  const includeArchived = searchParams.get("includeArchived") === "true";

  const contracts = await contractService.listManagedContracts({
    sowId: sowId ? Number(sowId) : undefined,
    includeArchived,
  });
  return NextResponse.json(contracts);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name: string;
    sow_id: number;
    hour_type: "monthly" | "total";
    type: "base" | "change_order" | "extension";
    assigned_hours: number;
    start_date: string;
    end_date?: string;
    status?: "active" | "paused" | "closed";
    parent_contract_id?: number;
  };

  const sow = await contractService.findStatementOfWorkDates(body.sow_id);
  if (!sow) {
    return NextResponse.json({ error: "SOW not found." }, { status: 400 });
  }
  const endDate = body.end_date ? new Date(body.end_date) : null;
  const dateError = contractService.validateContractWithinSow(sow, endDate);
  if (dateError) {
    return NextResponse.json({ error: dateError }, { status: 400 });
  }

  const contract = await contractService.createManagedContract({
    name: body.name,
    sowId: body.sow_id,
    hourType: body.hour_type,
    type: body.type,
    assignedHours: body.assigned_hours,
    startDate: new Date(body.start_date),
    endDate,
    status: body.status ?? "active",
    parentContractId: body.parent_contract_id ?? null,
  });
  return NextResponse.json(contract, { status: 201 });
}
