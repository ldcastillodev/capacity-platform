import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const monthDate = month
    ? new Date(month)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0));

  const grouped = await prisma.hourRecord.groupBy({
    by: ["contractId"],
    where: {
      isNonBillable: true,
      contractId: { not: null },
      date: { gte: monthDate, lte: monthEnd },
    },
    _sum: { hours: true },
  });

  if (grouped.length === 0) return NextResponse.json([]);

  const contracts = await prisma.contract.findMany({
    where: { id: { in: grouped.map((r) => r.contractId!) } },
    select: { id: true, name: true, sow: { select: { clientId: true, client: { select: { name: true } } } } },
  });
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
