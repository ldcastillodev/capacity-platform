import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const clientIdParam = searchParams.get("clientId");
  const roleType = searchParams.get("roleType");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 25)));

  // Build month filter without key-overwrite bug
  const monthFilter =
    from && to
      ? { month: { gte: new Date(from), lte: new Date(to) } }
      : from
      ? { month: { gte: new Date(from) } }
      : to
      ? { month: { lte: new Date(to) } }
      : {};

  const where = {
    ...monthFilter,
    ...(clientIdParam ? { clientId: Number(clientIdParam) } : {}),
    ...(roleType ? { roleType: roleType as any } : {}),
  };

  const [rows, total, ceremonyRows] = await Promise.all([
    prisma.monthlyConsumptionSummary.findMany({
      where,
      include: { client: { select: { id: true, name: true, region: true, currency: true } } },
      orderBy: [{ client: { name: "asc" } }, { month: "asc" }],
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.monthlyConsumptionSummary.count({ where }),
    prisma.ceremonyAttribution.groupBy({
      by: ["clientId", "month"],
      where: {
        ...monthFilter,
        ...(clientIdParam ? { clientId: Number(clientIdParam) } : {}),
      },
      _sum: { attributedHours: true },
    }),
  ]);

  // Build ceremony lookup: clientId-YYYY-MM → hours
  const ceremonyMap = new Map<string, number>();
  for (const r of ceremonyRows) {
    const key = `${r.clientId}-${new Date(r.month).toISOString().slice(0, 7)}`;
    ceremonyMap.set(key, (ceremonyMap.get(key) ?? 0) + Number(r._sum.attributedHours ?? 0));
  }

  const data = rows.map((r) => ({
    ...r,
    ceremonyHours:
      ceremonyMap.get(`${r.clientId}-${new Date(r.month).toISOString().slice(0, 7)}`) ?? 0,
  }));

  return NextResponse.json({
    data,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
