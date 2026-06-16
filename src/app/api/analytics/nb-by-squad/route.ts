import { NextRequest, NextResponse } from "next/server";
import { analyticsRawService } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const monthDate = month
    ? new Date(month)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0));

  const rows = await analyticsRawService.getNonBillableBySquad(monthDate, monthEnd);

  return NextResponse.json(rows);
}
