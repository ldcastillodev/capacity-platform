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
    by: ["clientId"],
    where: {
      isNonBillable: true,
      clientId: { not: null },
      date: { gte: monthDate, lte: monthEnd },
    },
    _sum: { hours: true },
  });

  if (grouped.length === 0) return NextResponse.json([]);

  const clients = await prisma.client.findMany({
    where: { id: { in: grouped.map((r) => r.clientId!) } },
    select: { id: true, name: true },
  });
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));

  const rows = grouped.map((r) => ({
    client_id: r.clientId,
    client_name: clientMap[r.clientId!] ?? `Client ${r.clientId}`,
    total_hours: parseFloat(String(r._sum.hours ?? 0)),
  }));

  return NextResponse.json(rows);
}
