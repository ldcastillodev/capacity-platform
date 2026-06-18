import { NextRequest, NextResponse } from "next/server";
import { hourRecordService } from "@/lib/db";
import { getMonthRange } from "@/lib/temporal";
import { parseHours } from "@/lib/utils/formatting";

/**
 * GET /api/contracts/[contractId]/daily-hours?year=YYYY&month=MM
 * Billable hours summed per calendar day for one contract within the month.
 * Returns only days that have hours; the chart fills missing days with 0.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const { contractId: contractIdRaw } = await params;
  const contractId = Number(contractIdRaw);
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  if (!Number.isInteger(contractId) || !Number.isInteger(year) || !Number.isInteger(month)) {
    return NextResponse.json({ error: "Invalid contractId, year or month" }, { status: 400 });
  }

  const { start: monthStart, end: monthEnd } = getMonthRange(
    new Date(Date.UTC(year, month - 1, 1))
  );

  const grouped = await hourRecordService.sumHoursByDayForContract(contractId, {
    gte: monthStart,
    lte: monthEnd,
  });

  const rows = grouped
    .map((g) => ({
      day: g.date.getUTCDate(),
      hours: parseHours(g._sum.hours),
    }))
    .filter((r) => r.hours > 0)
    .sort((a, b) => a.day - b.day);

  return NextResponse.json(rows);
}
