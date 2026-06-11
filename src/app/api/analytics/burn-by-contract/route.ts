import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { classifyContractStatus, expectedPaceFraction } from "@/lib/analytics/contract-status";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const monthDate = month
    ? new Date(month)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0));
  const asOf = new Date(Math.min(Date.now(), monthEnd.getTime()));

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
      let consumed: number;
      let pool: number;
      let expectedPct: number | null;

      if (contract.hourType === "total") {
        // Total-pool contract: cumulative consumption from contract start
        // through the selected month, against the lifetime pool.
        const agg = await prisma.hourRecord.aggregate({
          where: {
            contractId: contract.id,
            isNonBillable: false,
            date: { gte: contract.startDate, lte: monthEnd },
          },
          _sum: { hours: true },
        });
        consumed = parseFloat(String(agg._sum.hours ?? 0));
        pool = parseFloat(String(contract.assignedHours));
        expectedPct = contract.endDate
          ? expectedPaceFraction(contract.startDate, contract.endDate, asOf)
          : null;
      } else {
        const [agg, declEntries] = await Promise.all([
          prisma.hourRecord.aggregate({
            where: {
              contractId: contract.id,
              isNonBillable: false,
              date: { gte: monthDate, lte: monthEnd },
            },
            _sum: { hours: true },
          }),
          prisma.declarationRoleEntry.aggregate({
            where: { declaration: { contractId: contract.id, month: monthDate } },
            _sum: { declaredHours: true },
          }),
        ]);
        consumed = parseFloat(String(agg._sum.hours ?? 0));
        pool =
          parseFloat(String(declEntries._sum.declaredHours ?? 0)) ||
          parseFloat(String(contract.assignedHours));
        expectedPct = expectedPaceFraction(monthDate, monthEnd, asOf);
      }

      return {
        contract_id: contract.id,
        contract_name: contract.name,
        client_id: contract.sow.clientId,
        client_name: contract.sow.client.name,
        hour_type: contract.hourType,
        consumed_hours: consumed,
        pool_hours: pool,
        utilization_pct: pool > 0 ? consumed / pool : 0,
        expected_pct: expectedPct,
        status: classifyContractStatus({ consumedHours: consumed, poolHours: pool, expectedPct }),
      };
    }),
  );

  return NextResponse.json(rows);
}
