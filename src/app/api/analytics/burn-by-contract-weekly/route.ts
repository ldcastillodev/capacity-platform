import { NextRequest, NextResponse } from "next/server";
import { contractService, hourRecordService } from "@/lib/db";

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
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0));

  const contracts = await contractService.listActiveContractsForMonth(monthDate);

  const rows = await Promise.all(
    contracts.map(async (contract) => {
      const isTotal = contract.hourType === "total";

      const [records, priorAgg] = await Promise.all([
        hourRecordService.listBillableHoursForContractMonth(contract.id, monthDate, monthEnd),
        // Total-pool contract: consumption before the selected month draws
        // down the same lifetime pool (strict lt avoids double-counting).
        isTotal
          ? hourRecordService.sumBillableHoursByContract(contract.id, {
              gte: contract.startDate,
              lt: monthDate,
            })
          : null,
      ]);
      const prior = priorAgg ? parseFloat(String(priorAgg._sum.hours ?? 0)) : 0;

      const byWeek = new Map<string, number>();
      for (const r of records) {
        const key = weekStart(new Date(r.date));
        byWeek.set(key, (byWeek.get(key) ?? 0) + Number(r.hours));
      }

      // Total contracts: pool entering this month = lifetime pool minus past
      // consumption (unclamped — overrun shows negative). Monthly: prior = 0.
      const pool = Number(contract.assignedHours) - prior;
      const totalDaysUTC = monthEnd.getUTCDate();

      // Generate every week-start in the month so the chart always has full x-axis coverage
      const allWeeks: string[] = [];
      const firstWeekStr = weekStart(monthDate);
      let cur = new Date(firstWeekStr + "T00:00:00Z");
      while (cur <= monthEnd) {
        allWeeks.push(cur.toISOString().slice(0, 10));
        cur = new Date(cur.getTime() + 7 * 86400000);
      }

      let cumulative = 0;
      const weeks = allWeeks.map((week_start) => {
        cumulative += byWeek.get(week_start) ?? 0;
        const wDate = new Date(week_start + "T12:00:00Z");
        const daysElapsed = Math.min(
          Math.round((wDate.getTime() - monthDate.getTime()) / 86400000) + 7,
          totalDaysUTC
        );
        const expected_cumulative = pool > 0 ? pool * (daysElapsed / totalDaysUTC) : 0;
        return { week_start, cumulative_hours: cumulative, expected_cumulative, pool_hours: pool };
      });

      const consumed = cumulative;
      const consumption_pct = pool > 0 ? consumed / pool : 0;
      // Pace-relative taxonomy (≠ overview health taxonomy by design):
      // critical = ahead of expected pace, watch = behind, safe = on pace ±10%.
      const elapsedDays = Math.min(
        Math.max(Math.ceil((Date.now() - monthDate.getTime()) / 86400000), 0),
        totalDaysUTC
      );
      const expectedToDate = pool > 0 ? pool * (elapsedDays / totalDaysUTC) : 0;
      let alert_level: string;
      if (expectedToDate === 0) alert_level = consumed > 0 ? "critical" : "watch";
      else {
        const ratio = consumed / expectedToDate;
        if (ratio > 1.1) alert_level = "critical";
        else if (ratio < 0.9) alert_level = "watch";
        else alert_level = "safe";
      }

      return {
        contract_id: contract.id,
        contract_name: contract.name,
        client_id: contract.sow.clientId,
        client_name: contract.sow.client.name,
        hour_type: contract.hourType,
        pool_hours: pool,
        consumed_hours: consumed,
        consumption_pct,
        alert_level,
        weeks,
      };
    })
  );

  return NextResponse.json(rows.filter((r) => r.weeks.length > 0 || r.consumed_hours > 0));
}
