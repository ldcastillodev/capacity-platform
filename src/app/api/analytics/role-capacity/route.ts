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

  // One row per (squad, role) for the month. A role appears if it has
  // capacity (members holding it), declarations, or hours.
  // Billable hours follow hr.role_type (stamped at sync). Non-billable
  // records carry no role_type, so a person's monthly NB total is
  // attributed to their active role(s) and split across squads by
  // allocation share.
  // Caveat: a person holding two roles concurrently counts full capacity
  // and NB under each role — per-role figures are indicative, not
  // partitioned.
  const rows = await analyticsRawService.getRoleCapacityByMonth(monthDate, monthEnd);

  return NextResponse.json(rows);
}
