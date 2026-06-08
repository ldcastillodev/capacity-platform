import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  const monthDate = month ? new Date(month) : null;
  const monthEnd = monthDate
    ? new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0))
    : null;

  const decls = await prisma.monthlyRoleDeclaration.findMany({
    where: monthDate ? { month: monthDate } : {},
    orderBy: [{ month: "desc" }, { clientId: "asc" }],
    select: {
      id: true,
      contractId: true,
      clientId: true,
      squadId: true,
      month: true,
      status: true,
      client: { select: { id: true, name: true } },
      squad: { select: { id: true, name: true } },
      contract: { select: { id: true, name: true } },
      roles: { select: { roleType: true, declaredHours: true } },
    },
  });

  // aggregate consumed hours per (contractId, roleType) for the month
  const contractIds = [...new Set(decls.map((d) => d.contractId).filter((id): id is number => id !== null))];
  const consumed: Record<string, number> = {};

  if (contractIds.length > 0 && monthDate && monthEnd) {
    const hourGroups = await prisma.hourRecord.groupBy({
      by: ["contractId", "roleType"],
      where: {
        contractId: { in: contractIds },
        isNonBillable: false,
        date: { gte: monthDate, lte: monthEnd },
      },
      _sum: { hours: true },
    });
    for (const g of hourGroups) {
      if (g.contractId !== null && g.roleType !== null) {
        consumed[`${g.contractId}:${g.roleType}`] = Number(g._sum.hours ?? 0);
      }
    }
  }

  const result = decls.map((d) => ({
    id: d.id,
    contract_id: d.contractId,
    client_id: d.clientId,
    squad_id: d.squadId,
    month: d.month,
    status: d.status,
    client: d.client,
    squad: d.squad,
    contract: d.contract,
    roles: d.roles.map((r) => ({
      role_type: r.roleType,
      declared_hours: String(r.declaredHours),
      consumed_hours: d.contractId !== null ? (consumed[`${d.contractId}:${r.roleType}`] ?? 0) : 0,
    })),
  }));

  return NextResponse.json(result);
}
