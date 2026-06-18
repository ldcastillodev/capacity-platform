import { NextRequest, NextResponse } from "next/server";
import { analyticsRawService } from "@/lib/db";
import { getMonthRange } from "@/lib/temporal";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const monthDate = month
    ? new Date(month)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const { end: monthEnd } = getMonthRange(monthDate);

  const rows = await analyticsRawService.getNonBillableBySquad(monthDate, monthEnd);

  return NextResponse.json(rows);
}
