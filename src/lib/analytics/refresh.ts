import prisma from "../prisma";

// ─── Entry Point ─────────────────────────────────────────────────────────────

export async function runAnalyticsRefresh(_months?: Date[]): Promise<void> {
  const today = new Date();
  const currentMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  await runAnomalyDetection(currentMonth);
  await generateNonBillableSuggestions(currentMonth);
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

// ─── Non-Billable Enhancement Suggestions ─────────────────────────────────────

function workingDaysInMonth(year: number, month: number): number {
  const days = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

async function generateNonBillableSuggestions(month: Date): Promise<void> {
  const monthEnd = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));

  // NB hours per person+squad+category for the month
  const nbByCategory = await prisma.hourRecord.groupBy({
    by: ["personId", "squadId", "nonBillableCategoryId"],
    where: { isNonBillable: true, date: { gte: month, lte: monthEnd } },
    _sum: { hours: true },
  });
  if (nbByCategory.length === 0) return;

  const personIds = [...new Set(nbByCategory.map((r) => r.personId))];

  // Billable hours per person (nb% denominator)
  const billableByPerson = await prisma.hourRecord.groupBy({
    by: ["personId"],
    where: { isNonBillable: false, date: { gte: month, lte: monthEnd }, personId: { in: personIds } },
    _sum: { hours: true },
  });
  const billableMap = new Map(billableByPerson.map((r) => [r.personId, Number(r._sum.hours ?? 0)]));

  const persons = await prisma.person.findMany({
    where: { id: { in: personIds } },
    select: { id: true, weeklyCapacityHours: true },
  });
  const personCapMap = new Map(persons.map((p) => [p.id, Number(p.weeklyCapacityHours)]));

  const catIds = [...new Set(nbByCategory.map((r) => r.nonBillableCategoryId).filter(Boolean))] as number[];
  const categories = catIds.length > 0
    ? await prisma.nonBillableCategory.findMany({ where: { id: { in: catIds } } })
    : [];
  const catTypeMap = new Map(categories.map((c) => [c.id, c.type]));

  const wdays = workingDaysInMonth(month.getUTCFullYear(), month.getUTCMonth());

  // Aggregate per person+squad: total NB + per-category-type breakdown
  type Agg = { personId: number; squadId: number | null; totalHours: number; byType: Map<string, number> };
  const aggs = new Map<string, Agg>();
  for (const row of nbByCategory) {
    const key = `${row.personId}|${row.squadId}`;
    const agg = aggs.get(key) ?? { personId: row.personId, squadId: row.squadId, totalHours: 0, byType: new Map() };
    const hours = Number(row._sum.hours ?? 0);
    agg.totalHours += hours;
    const type = row.nonBillableCategoryId ? catTypeMap.get(row.nonBillableCategoryId) : undefined;
    if (type) agg.byType.set(type, (agg.byType.get(type) ?? 0) + hours);
    aggs.set(key, agg);
  }

  for (const { personId, squadId, totalHours, byType } of aggs.values()) {
    const weeklyCapacity = personCapMap.get(personId) ?? 40;
    const capacityHours = weeklyCapacity * (wdays / 5);
    const loggedHours = totalHours + (billableMap.get(personId) ?? 0);
    const nbPct = loggedHours > 0 ? totalHours / loggedHours : 0;

    if (nbPct > 0.25) {
      await upsertSuggestion(personId, squadId, month, "nonbillable_trend", totalHours, loggedHours * 0.15,
        `Non-billable time is ${(nbPct * 100).toFixed(0)}% of logged hours (${totalHours.toFixed(1)}h), above the 25% threshold.`,
        "Review recent non-billable entries and rebalance toward billable work.");
    }

    const ceremonyHours = byType.get("shared_ceremony") ?? 0;
    if (capacityHours > 0 && ceremonyHours > capacityHours * 0.10) {
      await upsertSuggestion(personId, squadId, month, "ceremony_overhead", ceremonyHours, capacityHours * 0.10,
        `Shared ceremony time is ${ceremonyHours.toFixed(1)}h, over 10% of monthly capacity (${capacityHours.toFixed(0)}h).`,
        "Trim or consolidate recurring ceremonies to reduce overhead.");
    }

    const leaveHours = byType.get("leave") ?? 0;
    if (capacityHours > 0 && leaveHours > capacityHours * 0.25) {
      await upsertSuggestion(personId, squadId, month, "pto_capacity_warning", leaveHours, null,
        `Leave time is ${leaveHours.toFixed(1)}h, over 25% of monthly capacity (${capacityHours.toFixed(0)}h) — reduced availability.`,
        "Account for reduced capacity when planning this person's commitments.");
    }
  }
}

async function upsertSuggestion(
  personId: number,
  squadId: number | null,
  month: Date,
  suggestionType: string,
  currentHours: number | null,
  suggestedHours: number | null,
  explanation: string,
  suggestedAction: string,
): Promise<void> {
  const existing = await prisma.nonBillableEnhancementSuggestion.findFirst({
    where: { personId, squadId, month, suggestionType: suggestionType as never, status: "open" },
  });
  if (existing) return;

  await prisma.nonBillableEnhancementSuggestion.create({
    data: {
      personId,
      squadId,
      month,
      suggestionType: suggestionType as never,
      explanation,
      suggestedAction,
      currentHours,
      suggestedHours,
    },
  });
}
