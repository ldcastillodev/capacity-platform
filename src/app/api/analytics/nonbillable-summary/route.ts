import { NextRequest, NextResponse } from "next/server";
import { hourRecordService, personService, nonBillableService } from "@/lib/db";

function workingDaysInMonth(year: number, month: number): number {
  const days = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const squadIdParam = searchParams.get("squad_id");

  const monthDate = month
    ? new Date(month)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0));
  const priorStart = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() - 1, 1));
  const priorEnd = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 0));

  const squadId = squadIdParam ? Number(squadIdParam) : undefined;

  // NB hours per person+squad+category for current month
  const nbByCategory = await hourRecordService.sumNonBillableHoursByPersonSquadCategory({
    monthStart: monthDate,
    monthEnd,
    squadId,
  });

  if (nbByCategory.length === 0) return NextResponse.json([]);

  const personIds = [...new Set(nbByCategory.map((r) => r.personId))];

  // Billable hours per person for nb% denominator
  const billableByPerson = await hourRecordService.sumBillableHoursByPerson(
    personIds,
    monthDate,
    monthEnd
  );
  const billableMap = new Map(billableByPerson.map((r) => [r.personId, Number(r._sum.hours ?? 0)]));

  // Prior month NB totals per person+squad for month-over-month delta
  const nbPrior = await hourRecordService.sumNonBillableHoursByPersonSquad({
    from: priorStart,
    to: priorEnd,
    squadId,
  });
  const priorMap = new Map(
    nbPrior.map((r) => [`${r.personId}|${r.squadId}`, Number(r._sum.hours ?? 0)])
  );

  // Person weekly capacity effective for the queried month, pro-rated by
  // days when it changed mid-month.
  const capRows = await personService.listCapacityHistoryForMonth(personIds, monthDate, monthEnd);
  const daysInMonth = Math.round((monthEnd.getTime() - monthDate.getTime()) / 86_400_000) + 1;
  const personCapMap = new Map<number, number>();
  for (const row of capRows) {
    const from = row.effectiveFrom > monthDate ? row.effectiveFrom : monthDate;
    const to = row.effectiveTo && row.effectiveTo < monthEnd ? row.effectiveTo : monthEnd;
    const daysActive = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    const weighted = Number(row.weeklyCapacityHours) * (daysActive / daysInMonth);
    personCapMap.set(row.personId, (personCapMap.get(row.personId) ?? 0) + weighted);
  }

  // Category metadata
  const catIds = [
    ...new Set(nbByCategory.map((r) => r.nonBillableCategoryId).filter(Boolean)),
  ] as number[];
  const categories =
    catIds.length > 0 ? await nonBillableService.listNonBillableCategoriesByIds(catIds) : [];
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const wdays = workingDaysInMonth(monthDate.getFullYear(), monthDate.getMonth());
  const monthStr = monthDate.toISOString().slice(0, 10);

  // Aggregate per person+squad totals
  const totals = new Map<string, { personId: number; squadId: number; totalHours: number }>();
  for (const row of nbByCategory) {
    const key = `${row.personId}|${row.squadId}`;
    const existing = totals.get(key) ?? {
      personId: row.personId,
      squadId: row.squadId,
      totalHours: 0,
    };
    existing.totalHours += Number(row._sum.hours ?? 0);
    totals.set(key, existing);
  }

  const result: Array<Record<string, unknown>> = [];
  let idSeq = 1;

  for (const [key, { personId, squadId, totalHours }] of totals.entries()) {
    const weeklyCapacity = personCapMap.get(personId) ?? 40;
    const capacityHours = weeklyCapacity * (wdays / 5);
    const billableHours = billableMap.get(personId) ?? 0;
    const loggedHours = totalHours + billableHours;
    const nbPct = loggedHours > 0 ? totalHours / loggedHours : 0;
    const priorNb = priorMap.has(key) ? priorMap.get(key)! : null;
    const delta = priorNb !== null ? totalHours - priorNb : null;

    // Total row (categoryType = null)
    result.push({
      id: idSeq++,
      personId,
      squadId,
      month: monthStr,
      categoryType: null,
      totalHours: String(totalHours),
      capacityHours: String(capacityHours),
      nonbillablePct: String(nbPct),
      monthOverMonthDelta: delta !== null ? String(delta) : null,
    });

    // Per-category rows
    for (const catRow of nbByCategory) {
      if (catRow.personId !== personId || catRow.squadId !== squadId) continue;
      if (!catRow.nonBillableCategoryId) continue;
      const cat = catMap.get(catRow.nonBillableCategoryId);
      if (!cat) continue;
      result.push({
        id: idSeq++,
        personId,
        squadId,
        month: monthStr,
        categoryType: cat.type,
        totalHours: String(Number(catRow._sum.hours ?? 0)),
        capacityHours: String(capacityHours),
        nonbillablePct: String(nbPct),
        monthOverMonthDelta: null,
      });
    }
  }

  return NextResponse.json(result);
}
