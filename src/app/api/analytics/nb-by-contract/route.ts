import { NextRequest, NextResponse } from "next/server";
import { hourRecordService, contractService } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const monthDate = month
    ? new Date(month)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0));

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
      total_hours: parseFloat(String(r._sum.hours ?? 0)),
    };
  });

  return NextResponse.json(rows);
}
