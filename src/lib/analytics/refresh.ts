import prisma from "../prisma";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

export async function runAnalyticsRefresh(_months?: Date[]): Promise<void> {
  const today = new Date();
  const currentMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  await deriveMissingDeclarations(currentMonth);
  await runAnomalyDetection(currentMonth);
}

// ─── Phase 4: Derive Missing Declarations ────────────────────────────────────

async function deriveMissingDeclarations(month: Date): Promise<void> {
  const contracts = await prisma.contract.findMany({
    where: {
      status: "active",
      startDate: { lte: month },
      OR: [{ endDate: null }, { endDate: { gte: month } }],
    },
    include: { sow: { select: { clientId: true } } },
  });

  for (const contract of contracts) {
    const realCount = await prisma.monthlyRoleDeclaration.count({
      where: {
        contractId: contract.id,
        month,
        NOT: { status: "derived" },
      },
    });
    if (realCount > 0) continue;

    let refRows = await prisma.monthlyRoleDeclaration.findMany({
      where: {
        contractId: contract.id,
        month: { gt: month },
        NOT: { status: "derived" },
      },
      orderBy: { month: "asc" },
    });

    if (refRows.length === 0) {
      refRows = await prisma.monthlyRoleDeclaration.findMany({
        where: {
          contractId: contract.id,
          month: { lt: month },
          NOT: { status: "derived" },
        },
        orderBy: { month: "desc" },
      });
    }

    if (refRows.length === 0) continue;

    const refMonth = refRows[0].month;
    const sameMonthRows = refRows.filter(
      (r) => r.month.getTime() === refMonth.getTime(),
    );

    const refTotal = sameMonthRows.reduce((s, r) => s + toNum(r.declaredHours), 0);
    if (refTotal <= 0) continue;

    const scale = toNum(contract.assignedHours) / refTotal;

    await prisma.monthlyRoleDeclaration.deleteMany({
      where: { contractId: contract.id, month, status: "derived" },
    });

    for (const ref of sameMonthRows) {
      const derivedHours = round2(toNum(ref.declaredHours) * scale);
      if (derivedHours <= 0) continue;
      await prisma.monthlyRoleDeclaration.create({
        data: {
          contractId: contract.id,
          clientId: contract.sow.clientId,
          squadId: ref.squadId,
          month,
          roleType: ref.roleType,
          declaredHours: derivedHours,
          status: "derived",
        },
      });
    }
  }
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
