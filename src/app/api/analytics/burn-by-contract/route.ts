import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const monthDate = month
    ? new Date(month)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0));

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
      const agg = await prisma.hourRecord.aggregate({
        where: {
          contractId: contract.id,
          isNonBillable: false,
          date: { gte: monthDate, lte: monthEnd },
        },
        _sum: { hours: true },
      });
      const consumed = parseFloat(String(agg._sum.hours ?? 0));
      const pool = parseFloat(String(contract.assignedHours));
      return {
        contract_id: contract.id,
        contract_name: contract.name,
        client_id: contract.sow.clientId,
        client_name: contract.sow.client.name,
        consumed_hours: consumed,
        pool_hours: pool,
        utilization_pct: pool > 0 ? consumed / pool : 0,
      };
    }),
  );

  return NextResponse.json(rows);
}
