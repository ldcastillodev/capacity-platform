import { NextRequest, NextResponse } from "next/server";
import { contractService } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const includeArchived = searchParams.get("includeArchived") === "true";

  const sows = await contractService.listStatementsOfWork({
    clientId: clientId ? Number(clientId) : undefined,
    includeArchived,
  });
  return NextResponse.json(sows);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name: string;
    client_id: number;
    start_date: string;
    end_date?: string;
  };

  if (!body.end_date) {
    return NextResponse.json({ error: "End date is required." }, { status: 400 });
  }

  const sow = await contractService.createStatementOfWork({
    name: body.name,
    clientId: body.client_id,
    startDate: new Date(body.start_date),
    endDate: new Date(body.end_date),
  });
  return NextResponse.json(sow, { status: 201 });
}
