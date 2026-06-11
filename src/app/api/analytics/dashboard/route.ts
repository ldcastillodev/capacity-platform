import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");

  const today = new Date();
  const monthDate = monthParam
    ? new Date(monthParam)
    : new Date(today.getFullYear(), today.getMonth(), 1);

  const [totalClients, openFlags, personsCount, squadsCount] = await Promise.all([
    prisma.client.count({ where: { isActive: true } }),
    prisma.anomalyFlag.count({ where: { month: monthDate, resolvedAt: null } }),
    prisma.person.count({ where: { isActive: true } }),
    prisma.squad.count({ where: { isActive: true } }),
  ]);

  return NextResponse.json({
    month: monthDate.toISOString().slice(0, 10),
    total_active_clients: totalClients,
    open_anomaly_flags: openFlags,
    persons_count: personsCount,
    squads_count: squadsCount,
  });
}
