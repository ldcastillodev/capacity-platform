import { NextRequest, NextResponse } from "next/server";
import { hourRecordService } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");
  const personId = searchParams.get("person_id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  const records = await hourRecordService.listHourRecords({
    clientId: clientId ? Number(clientId) : undefined,
    personId: personId ? Number(personId) : undefined,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
  });
  return NextResponse.json(records);
}
