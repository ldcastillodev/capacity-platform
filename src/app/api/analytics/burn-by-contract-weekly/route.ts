import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function weekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const monthDate = month
    ? new Date(month)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const totalDays = monthEnd.getDate();

  const contracts = await prisma.contract.findMany({
    where: {
      status: "active",
      startDate: { lte: monthDate },
      OR: [{ endDate: null }, { endDate: { gte: monthDate } }],
    },
    include: { sow: { include: { client: { select: { id: true, name: true } } } } },
  });

  const rows = await Promise.all(
    contracts.map(async (contract) => {
      const records = await prisma.hourRecord.findMany({
        where: {
          clientId: contract.sow.clientId,
          isNonBillable: false,
          date: { gte: monthDate, lte: monthEnd },
        },
        select: { date: true, hours: true },
      });

      const byWeek = new Map<string, number>();
      for (const r of records) {
        const key = weekStart(new Date(r.date));
        byWeek.set(key, (byWeek.get(key) ?? 0) + Number(r.hours));
      }

      const pool = Number(contract.assignedHours);
      const sortedWeeks = [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b));
      let cumulative = 0;
      const weeks = sortedWeeks.map(([week_start, hours]) => {
        cumulative += hours;
        const wDate = new Date(week_start + "T12:00:00");
        const daysElapsed = Math.min(
          Math.round((wDate.getTime() - monthDate.getTime()) / 86400000) + 7,
          totalDays,
        );
        const expected_cumulative = pool > 0 ? pool * (daysElapsed / totalDays) : 0;
        return { week_start, cumulative_hours: cumulative, expected_cumulative, pool_hours: pool };
      });

      const consumed = cumulative;
      const utilization_pct = pool > 0 ? consumed / pool : 0;
      let alert_level: string;
      if (consumed === 0) alert_level = "watch";
      else if (utilization_pct > 1.1) alert_level = "critical";
      else if (utilization_pct >= 0.9) alert_level = "watch";
      else if (utilization_pct >= 0.4) alert_level = "safe";
      else alert_level = "watch";

      return {
        contract_id: contract.id,
        contract_name: contract.name,
        client_id: contract.sow.clientId,
        client_name: contract.sow.client.name,
        pool_hours: pool,
        consumed_hours: consumed,
        utilization_pct,
        alert_level,
        weeks,
      };
    }),
  );

  return NextResponse.json(rows.filter((r) => r.weeks.length > 0 || r.consumed_hours > 0));
}
