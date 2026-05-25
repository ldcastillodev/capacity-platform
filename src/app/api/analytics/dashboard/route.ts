import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");

  const today = new Date();
  const monthDate = monthParam
    ? new Date(monthParam)
    : new Date(today.getFullYear(), today.getMonth(), 1);

  const nextMonth = new Date(monthDate);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const [totalClients, openFlags, understaffed, marginResult, burnSnapshots] =
    await Promise.all([
      prisma.client.count({ where: { isActive: true } }),
      prisma.anomalyFlag.count({ where: { month: monthDate, resolvedAt: null } }),
      prisma.staffingGapSnapshot.count({ where: { month: monthDate, isUnderstaffed: true } }),
      prisma.monthlyConsumptionSummary.aggregate({
        where: {
          month: monthDate,
          roleType: null,
          grossMarginPct: { not: null },
        },
        _avg: { grossMarginPct: true },
      }),
      prisma.weeklyBurnSnapshot.findMany({
        where: { weekStart: { gte: monthDate, lt: nextMonth }, roleType: null },
        select: { clientId: true, weekStart: true, alertLevel: true },
      }),
    ]);

  // Latest snapshot per client
  const latestByClient = new Map<number, { alertLevel: string; weekStart: Date }>();
  for (const snap of burnSnapshots) {
    const existing = latestByClient.get(snap.clientId);
    if (!existing || snap.weekStart > existing.weekStart) {
      latestByClient.set(snap.clientId, { alertLevel: snap.alertLevel, weekStart: snap.weekStart });
    }
  }

  const levelCounts: Record<string, number> = {};
  for (const { alertLevel } of latestByClient.values()) {
    levelCounts[alertLevel] = (levelCounts[alertLevel] ?? 0) + 1;
  }

  return NextResponse.json({
    month: monthDate.toISOString().slice(0, 10),
    total_active_clients: totalClients,
    clients_on_track: levelCounts["safe"] ?? 0,
    clients_at_risk: (levelCounts["watch"] ?? 0) + (levelCounts["warning"] ?? 0),
    clients_critical: levelCounts["critical"] ?? 0,
    open_anomaly_flags: openFlags,
    understaffed_roles: understaffed,
    total_gross_margin_pct: marginResult._avg.grossMarginPct ?? null,
  });
}
