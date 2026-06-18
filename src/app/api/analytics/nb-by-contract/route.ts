import { NextRequest, NextResponse } from "next/server";
import { hourRecordService, contractService } from "@/lib/db";
import { getMonthRange } from "@/lib/temporal";
import { parseHours } from "@/lib/utils/formatting";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const monthDate = month
    ? new Date(month)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const { end: monthEnd } = getMonthRange(monthDate);

  const grouped = await hourRecordService.sumNonBillableHoursByContract(monthDate, monthEnd);

  if (grouped.length === 0) return NextResponse.json([]);

  const contracts = await contractService.listContractsByIds(grouped.map((r) => r.contractId!));
  const contractMap = Object.fromEntries(contracts.map((c) => [c.id, c]));

  const rows = grouped.map((r) => {
    const c = contractMap[r.contractId!];
    return {
      contract_id: r.contractId,
      contract_name: c?.name ?? `Contract ${r.contractId}`,
      client_name: c?.sow.client.name ?? "Unknown",
      total_hours: parseHours(r._sum.hours),
    };
  });

  return NextResponse.json(rows);
}
