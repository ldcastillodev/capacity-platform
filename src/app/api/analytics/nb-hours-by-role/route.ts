import { NextRequest, NextResponse } from "next/server";
import { hourRecordService } from "@/lib/db";
import { getMonthRange } from "@/lib/temporal";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const squadId = searchParams.get("squad_id");

  if (!month) {
    return NextResponse.json({ error: "month required" }, { status: 400 });
  }

  const monthDate = new Date(month);
  const { end: monthEnd } = getMonthRange(monthDate);

  const entries = await hourRecordService.listNonBillableHoursForRoleBreakdown({
    monthStart: monthDate,
    monthEnd,
    squadId: squadId ? Number(squadId) : undefined,
  });

  const byRole: Record<string, number> = {};
  for (const entry of entries) {
    const role = entry.roleType ?? "unknown";
    byRole[role] = (byRole[role] ?? 0) + Number(entry.hours);
  }

  return NextResponse.json(byRole);
}
