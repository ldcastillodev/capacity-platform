import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");

  const today = new Date();
  const monthDate = monthParam
    ? new Date(monthParam)
    : new Date(today.getFullYear(), today.getMonth(), 1);

  const [totalClients, openFlags] = await Promise.all([
    prisma.client.count({ where: { isActive: true } }),
    prisma.anomalyFlag.count({ where: { month: monthDate, resolvedAt: null } }),
  ]);

  return NextResponse.json({
    month: monthDate.toISOString().slice(0, 10),
    total_active_clients: totalClients,
    clients_on_track: 0,
    clients_at_risk: 0,
    clients_critical: 0,
    open_anomaly_flags: openFlags,
    understaffed_roles: 0,
    total_gross_margin_pct: null,
  });
}
