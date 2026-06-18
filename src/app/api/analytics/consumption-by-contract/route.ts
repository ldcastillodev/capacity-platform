import { NextRequest, NextResponse } from "next/server";
import { contractService, hourRecordService } from "@/lib/db";
import { getMonthRange } from "@/lib/temporal";
import { parseHours } from "@/lib/utils/formatting";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const monthDate = month
    ? new Date(month)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const { end: monthEnd } = getMonthRange(monthDate);

  const contracts = await contractService.listActiveContractsForMonth(monthDate, {
    includeInactive: true,
  });

  const rows = await Promise.all(
    contracts.map(async (contract) => {
      const [hoursAgg, priorAgg] = await Promise.all([
        hourRecordService.sumBillableHoursByContract(contract.id, {
          gte: monthDate,
          lte: monthEnd,
        }),
        contract.hourType === "total"
          ? hourRecordService.sumBillableHoursByContract(contract.id, {
              gte: contract.startDate,
              lt: monthDate,
            })
          : Promise.resolve(null),
      ]);

      const consumed = parseHours(hoursAgg._sum.hours);
      const pool = parseHours(contract.assignedHours);

      if (contract.hourType === "total") {
        // Total-pool contract: declarations are planned hours, not the pool.
        // Remaining draws down across the contract lifetime (unclamped so
        // overruns show as negative).
        const prior = parseHours(priorAgg?._sum.hours);
        return {
          contract_id: contract.id,
          contract_name: contract.name,
          contract_type: contract.type,
          client_id: contract.sow.clientId,
          client_name: contract.sow.client.name,
          hour_type: contract.hourType,
          declared_hours: pool,
          prior_consumed_hours: prior,
          consumed_hours: consumed,
          remaining_hours: pool - prior - consumed,
          consumption_pct: pool > 0 ? (prior + consumed) / pool : 0,
          contract_status: contract.status,
        };
      }

      const remaining = Math.max(pool - consumed, 0);
      return {
        contract_id: contract.id,
        contract_name: contract.name,
        contract_type: contract.type,
        client_id: contract.sow.clientId,
        client_name: contract.sow.client.name,
        hour_type: contract.hourType,
        declared_hours: pool,
        prior_consumed_hours: null,
        consumed_hours: consumed,
        remaining_hours: remaining,
        consumption_pct: pool > 0 ? consumed / pool : 0,
        contract_status: contract.status,
      };
    })
  );

  return NextResponse.json(rows);
}
