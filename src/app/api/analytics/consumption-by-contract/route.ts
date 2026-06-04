import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const monthDate = month
    ? new Date(month)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

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
      const [hoursAgg, declAgg] = await Promise.all([
        prisma.hourRecord.aggregate({
          where: {
            clientId: contract.sow.clientId,
            isNonBillable: false,
            date: { gte: monthDate, lte: monthEnd },
          },
          _sum: { hours: true },
        }),
        prisma.monthlyRoleDeclaration.aggregate({
          where: { contractId: contract.id, month: monthDate },
          _sum: { declaredHours: true },
        }),
      ]);

      const consumed = parseFloat(String(hoursAgg._sum.hours ?? 0));
      const declared = parseFloat(String(declAgg._sum.declaredHours ?? 0)) || parseFloat(String(contract.assignedHours));
      const remaining = Math.max(declared - consumed, 0);
      return {
        contract_id: contract.id,
        contract_name: contract.name,
        client_id: contract.sow.clientId,
        client_name: contract.sow.client.name,
        declared_hours: declared,
        consumed_hours: consumed,
        remaining_hours: remaining,
        utilization_pct: declared > 0 ? consumed / declared : 0,
      };
    }),
  );

  return NextResponse.json(rows);
}
