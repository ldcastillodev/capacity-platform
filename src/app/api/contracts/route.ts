import { NextRequest, NextResponse } from "next/server";
import { contractService } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");

  const contracts = await contractService.listActiveContracts({
    clientId: clientId ? Number(clientId) : undefined,
  });
  return NextResponse.json(contracts);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    sow_id: number;
    name: string;
    hour_type: string;
    type: string;
    assigned_hours: number;
    start_date: string;
    end_date?: string;
    status?: string;
  };

  const contract = await contractService.createContract({
    sowId: body.sow_id,
    name: body.name,
    hourType: body.hour_type as never,
    type: body.type as never,
    assignedHours: body.assigned_hours,
    startDate: new Date(body.start_date),
    endDate: body.end_date ? new Date(body.end_date) : null,
    status: (body.status as never) ?? "active",
  });
  return NextResponse.json(contract, { status: 201 });
}
