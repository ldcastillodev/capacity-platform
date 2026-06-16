import { NextRequest, NextResponse } from "next/server";
import { contractService, hourRecordService, declarationService } from "@/lib/db";

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
      const [hoursAgg, declEntries, priorAgg] = await Promise.all([
        hourRecordService.sumBillableHoursByContract(contract.id, {
          gte: monthDate,
          lte: monthEnd,
        }),
        declarationService.sumDeclaredHoursByContract(contract.id, monthDate),
        contract.hourType === "total"
          ? hourRecordService.sumBillableHoursByContract(contract.id, {
              gte: contract.startDate,
              lt: monthDate,
            })
          : Promise.resolve(null),
      ]);

      const consumed = parseFloat(String(hoursAgg._sum.hours ?? 0));

      if (contract.hourType === "total") {
        // Total-pool contract: declarations are planned hours, not the pool.
        // Remaining draws down across the contract lifetime (unclamped so
        // overruns show as negative).
        const pool = parseFloat(String(contract.assignedHours));
        const prior = parseFloat(String(priorAgg?._sum.hours ?? 0));
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
        };
      }

      const declared =
        parseFloat(String(declEntries._sum.declaredHours ?? 0)) ||
        parseFloat(String(contract.assignedHours));
      const remaining = Math.max(declared - consumed, 0);
      return {
        contract_id: contract.id,
        contract_name: contract.name,
        contract_type: contract.type,
        client_id: contract.sow.clientId,
        client_name: contract.sow.client.name,
        hour_type: contract.hourType,
        declared_hours: declared,
        prior_consumed_hours: null,
        consumed_hours: consumed,
        remaining_hours: remaining,
        consumption_pct: declared > 0 ? consumed / declared : 0,
      };
    })
  );

  return NextResponse.json(rows);
}
