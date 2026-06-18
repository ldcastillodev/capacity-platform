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

  // One row per squad-member for the month (empty squads keep one row with
  // null person fields).
  // Billable hours follow hr.squad_id (client work is squad-specific).
  // Non-billable hours are not squad-specific, so a person's monthly NB
  // total is split across their squads by allocation share — a 50/50
  // person shows half their NB in each squad. People with NB hours but no
  // membership keep NB at the recorded squad.
  const rows = await analyticsRawService.getSquadCapacityByMonth(monthDate, monthEnd);

  return NextResponse.json(rows);
}
