import prisma from "../prisma";

// ─── Entry Point ─────────────────────────────────────────────────────────────

export async function runAnalyticsRefresh(_months?: Date[]): Promise<void> {
  const today = new Date();
  const currentMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  await runAnomalyDetection(currentMonth);
}

// ─── Phase 6: Anomaly Detection ───────────────────────────────────────────────

async function runAnomalyDetection(month: Date): Promise<void> {
  const activeClients = await prisma.client.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const today = new Date();

  for (const { id: clientId } of activeClients) {
    const lastEntry = await prisma.hourRecord.findFirst({
      where: { clientId },
      orderBy: { date: "desc" },
      select: { date: true },
    });

    if (lastEntry) {
      const daysDiff = Math.floor(
        (today.getTime() - lastEntry.date.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysDiff > 2) {
        await upsertAnomaly(
          clientId,
          month,
          null,
          "missing_data",
          "medium",
          `No hours logged for ${daysDiff} days.`,
        );
      }
    }
  }
}

async function upsertAnomaly(
  clientId: number,
  month: Date,
  roleType: string | null,
  flagType: string,
  severity: string,
  explanation: string,
): Promise<void> {
  const existing = await prisma.anomalyFlag.findFirst({
    where: {
      clientId,
      month,
      flagType: flagType as never,
      roleType: roleType as never ?? null,
      resolvedAt: null,
    },
  });
  if (existing) return;

  await prisma.anomalyFlag.create({
    data: {
      clientId,
      month,
      roleType: roleType as never ?? null,
      flagType: flagType as never,
      severity: severity as never,
      explanation,
      detectorVersion: "rules_v1",
    },
  });
}
