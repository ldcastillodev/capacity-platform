import { Decimal } from "@prisma/client/runtime/library";
import prisma from "../prisma";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLANNED_NB_PER_PERSON: Record<string, number> = {
  project_manager: 33,
  tech_lead: 33,
  seo: 29,
  product_manager: 33,
  qa: 29,
  frontend_dev: 29,
  backend_dev: 29,
  fullstack_dev: 29,
  ux_designer: 15,
  content_author: 15,
  client_services: 33,
  devops: 29,
  data_engineer: 29,
};

const FULL_NB_ROLES = new Set(["scrum_master"]);
const DEV_ROLES = new Set(["frontend_dev", "backend_dev", "fullstack_dev"]);
const DEV_CANONICAL = "frontend_dev";
const NB_COUNTED_TYPES = ["shared_ceremony", "internal_meeting", "training"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthEnd(month: Date): Date {
  const d = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));
  return d;
}

function priorMonth(month: Date): Date {
  const d = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1));
  return d;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v));
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

export async function runAnalyticsRefresh(months?: Date[]): Promise<void> {
  const today = new Date();
  const currentMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const prior = priorMonth(currentMonth);

  const toRefresh = months ?? [currentMonth, prior];

  for (const m of toRefresh) {
    await refreshConsumptionSummaries(m);
    await refreshBurnSnapshots(m);
  }

  await deriveMissingDeclarations(currentMonth);
  await refreshStaffingGaps(currentMonth);
  await runAnomalyDetection(currentMonth);
  await refreshNonbillableSummaries(currentMonth);
}

// ─── Phase 1 & 2: Consumption Summaries ──────────────────────────────────────

async function refreshConsumptionSummaries(month: Date): Promise<void> {
  const mEnd = monthEnd(month);

  const activeClients = await prisma.client.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const { id: clientId } of activeClients) {
    const contract = await prisma.contract.findFirst({
      where: {
        sow: { clientId },
        status: "active",
        startDate: { lte: month },
        OR: [{ endDate: null }, { endDate: { gte: month } }],
      },
    });
    if (!contract) continue;

    await upsertConsumptionRow(clientId, month, mEnd, null, contract.assignedHours);

    const roles = await prisma.monthlyRoleDeclaration.findMany({
      where: { clientId, month },
      select: { roleType: true },
      distinct: ["roleType"],
    });

    for (const { roleType } of roles) {
      await upsertConsumptionRow(clientId, month, mEnd, roleType, contract.assignedHours);
    }
  }
}

async function upsertConsumptionRow(
  clientId: number,
  month: Date,
  mEnd: Date,
  roleType: string | null,
  poolHours: Decimal,
): Promise<void> {
  const baseWhere = { clientId, date: { gte: month, lte: mEnd } };
  const roleFilter = roleType ? { roleType: roleType as never } : {};

  const retainerH = await sumHours({ ...baseWhere, budgetSource: "retainer", ...roleFilter });
  const teH = 0;
  const coH = 0;
  const smeH = 0;

  const consumed = retainerH + teH + coH + smeH;

  let declaredHours = 0;
  if (roleType) {
    const decl = await prisma.monthlyRoleDeclaration.findFirst({
      where: { clientId, month, roleType: roleType as never },
      select: { declaredHours: true },
    });
    declaredHours = toNum(decl?.declaredHours);
  } else {
    const agg = await prisma.monthlyRoleDeclaration.aggregate({
      where: { clientId, month },
      _sum: { declaredHours: true },
    });
    const sumDecl = toNum(agg._sum.declaredHours);
    declaredHours = sumDecl > 0 ? sumDecl : toNum(poolHours);
  }

  const remaining = Math.max(declaredHours - retainerH, 0);
  const utilizationPct = declaredHours > 0 ? round4(retainerH / declaredHours) : 0;

  // Aggregate from HourRecord snapshot columns (not live rate resolution)
  const billedRevenue = await sumSnapshotAmount(clientId, month, mEnd, roleType, "billedAmountSnapshot");
  const directCost = await sumSnapshotAmount(clientId, month, mEnd, roleType, "costAmountSnapshot");
  let grossMargin: number | null = null;
  let grossMarginPct: number | null = null;
  if (billedRevenue !== null && directCost !== null) {
    grossMargin = round2(billedRevenue - directCost);
    grossMarginPct = billedRevenue > 0 ? round4(grossMargin / billedRevenue) : 0;
  }

  const data = {
    declaredHours: round2(declaredHours),
    consumedHours: round2(consumed),
    retainerHours: round2(retainerH),
    teHours: round2(teH),
    coHours: round2(coH),
    smeHours: round2(smeH),
    remainingHours: round2(remaining),
    utilizationPct,
    billedRevenue: billedRevenue !== null ? round2(billedRevenue) : null,
    directCost: directCost !== null ? round2(directCost) : null,
    grossMargin,
    grossMarginPct,
    lastRefreshed: new Date(),
  };

  const existingConsumption = await prisma.monthlyConsumptionSummary.findFirst({
    where: { clientId, month, roleType: (roleType as never) ?? null },
    select: { id: true },
  });
  if (existingConsumption) {
    await prisma.monthlyConsumptionSummary.update({ where: { id: existingConsumption.id }, data });
  } else {
    await prisma.monthlyConsumptionSummary.create({
      data: { clientId, month, roleType: (roleType as never) ?? null, ...data },
    });
  }
}

async function sumHours(where: Record<string, unknown>): Promise<number> {
  const agg = await prisma.hourRecord.aggregate({
    where: where as never,
    _sum: { hours: true },
  });
  return toNum(agg._sum.hours);
}

/**
 * Aggregate billedAmountSnapshot or costAmountSnapshot from HourRecord directly.
 * Returns null only when no rows with a non-null snapshot value exist.
 */
async function sumSnapshotAmount(
  clientId: number,
  month: Date,
  mEnd: Date,
  roleType: string | null,
  field: "billedAmountSnapshot" | "costAmountSnapshot",
): Promise<number | null> {
  const agg = await prisma.hourRecord.aggregate({
    where: {
      clientId,
      date: { gte: month, lte: mEnd },
      ...(roleType ? { roleType: roleType as never } : {}),
      [field]: { not: null },
    } as never,
    _sum: { [field]: true } as never,
  });
  const sum = (agg._sum as Record<string, unknown>)[field];
  if (sum === null || sum === undefined) return null;
  return toNum(sum);
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

// ─── Phase 5: Staffing Gaps ───────────────────────────────────────────────────

async function refreshStaffingGaps(month: Date): Promise<void> {
  const mEnd = monthEnd(month);

  await prisma.staffingGapSnapshot.deleteMany({
    where: {
      month,
      roleType: { in: ["backend_dev", "fullstack_dev"] as never[] },
    },
  });

  const squads = await prisma.squad.findMany({ select: { id: true } });
  const covered = new Set<string>();

  for (const { id: squadId } of squads) {
    const configs = await prisma.squadCapacityConfig.findMany({
      where: { squadId },
    });

    const devConfigs = configs.filter((c) => DEV_ROLES.has(c.roleType));
    const nonDevConfigs = configs.filter((c) => !DEV_ROLES.has(c.roleType));

    for (const config of nonDevConfigs) {
      const available = await calcAvailableHours(squadId, config.roleType, month, mEnd);
      const committed = await calcCommittedHours(squadId, [config.roleType], month);
      const hardBuffer = calcPlannedNbHours(config.roleType, available);
      const softBuffer = round2(available * toNum(config.softBufferPct));
      const actual = await calcActualHours(squadId, [config.roleType], month, mEnd);
      const actualNb = await calcActualNbHours(squadId, [config.roleType], month, mEnd);

      await upsertGapSnapshot(squadId, config.roleType, month, {
        available,
        committed,
        hardBuffer,
        softBuffer,
        actual,
        actualNb,
        hardBufferPct: toNum(config.hardBufferPct),
        softBufferPct: toNum(config.softBufferPct),
      });

      covered.add(`${squadId}:${config.roleType}`);
    }

    if (devConfigs.length > 0) {
      const devRoleTypes = devConfigs.map((c) => c.roleType);
      const available = (
        await Promise.all(devConfigs.map((c) => calcAvailableHours(squadId, c.roleType, month, mEnd)))
      ).reduce((a, b) => a + b, 0);
      const committed = await calcCommittedHours(squadId, devRoleTypes, month);
      const hardBuffer = calcPlannedNbHours(DEV_CANONICAL as never, available);
      const canonicalConfig = devConfigs.find((c) => c.roleType === DEV_CANONICAL) ?? devConfigs[0];
      const softBuffer = round2(available * toNum(canonicalConfig.softBufferPct));
      const actual = await calcActualHours(squadId, devRoleTypes, month, mEnd);
      const actualNb = await calcActualNbHours(squadId, devRoleTypes, month, mEnd);

      await upsertGapSnapshot(squadId, DEV_CANONICAL as never, month, {
        available,
        committed,
        hardBuffer,
        softBuffer,
        actual,
        actualNb,
        hardBufferPct: toNum(canonicalConfig.hardBufferPct),
        softBufferPct: toNum(canonicalConfig.softBufferPct),
      });

      DEV_ROLES.forEach((rt) => covered.add(`${squadId}:${rt}`));
    }
  }

  const decls = await prisma.monthlyRoleDeclaration.groupBy({
    by: ["squadId", "roleType"],
    where: { month, squadId: { not: 0 } },
    _sum: { declaredHours: true },
  });

  for (const row of decls) {
    if (!row.squadId) continue;
    const key = `${row.squadId}:${row.roleType}`;
    if (covered.has(key)) continue;
    const committed = toNum(row._sum.declaredHours);
    if (committed <= 0) continue;

    await upsertGapSnapshot(row.squadId, row.roleType as never, month, {
      available: 0,
      committed,
      hardBuffer: 0,
      softBuffer: 0,
      actual: 0,
      actualNb: 0,
    });
  }
}

async function calcAvailableHours(
  squadId: number,
  roleType: unknown,
  month: Date,
  mEnd: Date,
): Promise<number> {
  const members = await prisma.squadMembership.findMany({
    where: {
      squadId,
      effectiveFrom: { lte: mEnd },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: month } }],
    },
    include: { person: { select: { weeklyCapacityHours: true, id: true } } },
  });

  let total = 0;
  for (const m of members) {
    const hasRole = await prisma.personRole.findFirst({
      where: {
        personId: m.personId,
        roleType: roleType as never,
        effectiveFrom: { lte: mEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: month } }],
      },
    });
    if (!hasRole) continue;

    const weeklyHours = toNum(m.person.weeklyCapacityHours);
    const workingDays = workingDaysInMonth(month);
    total += weeklyHours * (workingDays / 5) * toNum(m.allocationPct);
  }
  return round2(total);
}

function workingDaysInMonth(month: Date): number {
  const year = month.getUTCFullYear();
  const mon = month.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, mon + 1, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(Date.UTC(year, mon, d)).getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

async function calcCommittedHours(
  squadId: number,
  roleTypes: unknown[],
  month: Date,
): Promise<number> {
  const agg = await prisma.monthlyRoleDeclaration.aggregate({
    where: { squadId, month, roleType: { in: roleTypes as never[] } },
    _sum: { declaredHours: true },
  });
  return toNum(agg._sum.declaredHours);
}

async function calcActualHours(
  squadId: number,
  roleTypes: unknown[],
  month: Date,
  mEnd: Date,
): Promise<number> {
  const agg = await prisma.hourRecord.aggregate({
    where: {
      person: {
        squadMemberships: { some: { squadId } },
      },
      roleType: { in: roleTypes as never[] },
      date: { gte: month, lte: mEnd },
    },
    _sum: { hours: true },
  });
  return round2(toNum(agg._sum.hours));
}

async function calcActualNbHours(
  squadId: number,
  roleTypes: unknown[],
  month: Date,
  mEnd: Date,
): Promise<number> {
  const members = await prisma.squadMembership.findMany({
    where: {
      squadId,
      effectiveFrom: { lte: mEnd },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: month } }],
    },
    select: { personId: true, allocationPct: true },
  });

  const nbCats = await prisma.nonBillableCategory.findMany({
    where: { type: { in: NB_COUNTED_TYPES as never[] } },
    select: { id: true },
  });
  const nbCatIds = nbCats.map((c) => c.id);

  let total = 0;
  for (const { personId, allocationPct } of members) {
    const hasRole = await prisma.personRole.findFirst({
      where: {
        personId,
        roleType: { in: roleTypes as never[] },
        effectiveFrom: { lte: mEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: month } }],
      },
    });
    if (!hasRole) continue;

    const agg = await prisma.nonBillableEntry.aggregate({
      where: {
        personId,
        squadId,
        categoryId: { in: nbCatIds },
        date: { gte: month, lte: mEnd },
      },
      _sum: { hours: true },
    });
    total += toNum(agg._sum.hours) * toNum(allocationPct);
  }
  return round2(total);
}

function calcPlannedNbHours(roleType: unknown, available: number): number {
  const key = String(roleType);
  if (FULL_NB_ROLES.has(key)) return available;
  return PLANNED_NB_PER_PERSON[key] ?? 0;
}

interface GapData {
  available: number;
  committed: number;
  hardBuffer: number;
  softBuffer: number;
  actual: number;
  actualNb: number;
  hardBufferPct?: number;
  softBufferPct?: number;
}

async function upsertGapSnapshot(
  squadId: number,
  roleType: unknown,
  month: Date,
  { available, committed, hardBuffer, softBuffer, actual, actualNb, hardBufferPct, softBufferPct }: GapData,
): Promise<void> {
  const netGap = round2(available - hardBuffer - committed);
  const unplanned = round2(Math.max(0, actual - committed));
  const effectiveNb = Math.max(actualNb, hardBuffer);
  const commitmentRatio =
    available > 0 ? round4((committed + unplanned + effectiveNb) / available) : 0;
  const isUnderstaffed = netGap < 0;
  const isOverstaffed = commitmentRatio < 0.85;

  // Snapshot fields: capture current capacity and buffer policy at calculation time
  const snapshotFields = {
    capacityHoursAtTime: round2(available),
    ...(hardBufferPct !== undefined && { hardBufferPctAtTime: hardBufferPct }),
    ...(softBufferPct !== undefined && { softBufferPctAtTime: softBufferPct }),
  };

  await prisma.staffingGapSnapshot.upsert({
    where: { squadId_roleType_month: { squadId, roleType: roleType as never, month } },
    create: {
      squadId,
      roleType: roleType as never,
      month,
      totalAvailableHours: round2(available),
      hardBufferHours: round2(hardBuffer),
      softBufferHours: round2(softBuffer),
      committedHours: round2(committed),
      actualHours: round2(actual),
      unplannedHours: unplanned,
      actualNbHours: round2(actualNb),
      netGapHours: netGap,
      commitmentRatio,
      isUnderstaffed,
      isOverstaffed,
      ...snapshotFields,
    },
    update: {
      totalAvailableHours: round2(available),
      hardBufferHours: round2(hardBuffer),
      softBufferHours: round2(softBuffer),
      committedHours: round2(committed),
      actualHours: round2(actual),
      unplannedHours: unplanned,
      actualNbHours: round2(actualNb),
      netGapHours: netGap,
      commitmentRatio,
      isUnderstaffed,
      isOverstaffed,
      calculatedAt: new Date(),
      ...snapshotFields,
    },
  });
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

    if (today.getUTCDate() >= 14) {
      const summary = await prisma.monthlyConsumptionSummary.findFirst({
        where: { clientId, month, roleType: null },
      });
      if (summary && toNum(summary.utilizationPct) < 0.4) {
        const pctDisplay = (toNum(summary.utilizationPct) * 100).toFixed(0);
        await upsertAnomaly(
          clientId,
          month,
          null,
          "underburn_risk",
          "medium",
          `Utilization at ${pctDisplay}% past mid-month. Risk of significant unused hours at month end.`,
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

// ─── Phase 7: Non-Billable Summaries ─────────────────────────────────────────

async function refreshNonbillableSummaries(month: Date): Promise<void> {
  const mEnd = monthEnd(month);
  const prior = priorMonth(month);

  const persons = await prisma.person.findMany({
    where: { isActive: true },
    select: { id: true, weeklyCapacityHours: true },
  });

  for (const { id: personId, weeklyCapacityHours } of persons) {
    const capacityHours = round2(toNum(weeklyCapacityHours) * 4.33);

    const primaryMembership = await prisma.squadMembership.findFirst({
      where: {
        personId,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: { allocationPct: "desc" },
      select: { squadId: true },
    });
    if (!primaryMembership) continue;
    const squadId = primaryMembership.squadId;

    const billableHours = await sumHours({
      personId,
      date: { gte: month, lte: mEnd },
    });

    const totalNbAgg = await prisma.nonBillableEntry.aggregate({
      where: { personId, date: { gte: month, lte: mEnd } },
      _sum: { hours: true },
    });
    const totalNbHours = toNum(totalNbAgg._sum.hours);
    const totalLogged = billableHours + totalNbHours;

    const categoryTypes: (string | null)[] = [
      null,
      "shared_ceremony",
      "leave",
      "internal_meeting",
      "training",
      "company",
    ];

    for (const categoryType of categoryTypes) {
      let typeHours = 0;
      if (categoryType === null) {
        typeHours = totalNbHours;
      } else {
        const agg = await prisma.nonBillableEntry.aggregate({
          where: {
            personId,
            date: { gte: month, lte: mEnd },
            category: { type: categoryType as never },
          },
          _sum: { hours: true },
        });
        typeHours = toNum(agg._sum.hours);
      }

      const priorRow = await prisma.monthlyNonBillableSummary.findFirst({
        where: {
          personId,
          month: prior,
          categoryType: categoryType as never ?? null,
        },
        select: { totalHours: true },
      });
      const priorHours = priorRow ? toNum(priorRow.totalHours) : null;
      const momDelta = priorHours !== null ? round2(typeHours - priorHours) : null;
      const nbPct = totalLogged > 0 ? round4(typeHours / totalLogged) : 0;

      const existingNb = await prisma.monthlyNonBillableSummary.findFirst({
        where: { personId, month, categoryType: (categoryType as never) ?? null },
        select: { id: true },
      });
      const nbUpdateData = {
        squadId,
        totalHours: round2(typeHours),
        capacityHours,
        nonbillablePct: nbPct,
        billableHoursLost: round2(typeHours),
        priorMonthHours: priorHours !== null ? round2(priorHours) : null,
        monthOverMonthDelta: momDelta,
        lastRefreshed: new Date(),
      };
      if (existingNb) {
        await prisma.monthlyNonBillableSummary.update({ where: { id: existingNb.id }, data: nbUpdateData });
      } else {
        await prisma.monthlyNonBillableSummary.create({
          data: {
            personId,
            squadId,
            month,
            categoryType: (categoryType as never) ?? null,
            totalHours: round2(typeHours),
            capacityHours,
            nonbillablePct: nbPct,
            billableHoursLost: round2(typeHours),
            priorMonthHours: priorHours !== null ? round2(priorHours) : null,
            monthOverMonthDelta: momDelta,
          },
        });
      }
    }
  }

  await runEnhancementEngine(month);
}

async function runEnhancementEngine(month: Date): Promise<void> {
  const prior = priorMonth(month);
  const twoMonthsAgo = priorMonth(prior);

  const totalSummaries = await prisma.monthlyNonBillableSummary.findMany({
    where: { month, categoryType: null },
  });

  for (const summary of totalSummaries) {
    if (toNum(summary.nonbillablePct) > 0.2) {
      const person = await prisma.person.findUnique({
        where: { id: summary.personId },
        select: { name: true, weeklyCapacityHours: true },
      });
      if (!person) continue;
      const pctDisplay = (toNum(summary.nonbillablePct) * 100).toFixed(0);
      const hoursDisplay = toNum(summary.totalHours).toFixed(1);
      const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const suggested = round2(
        toNum(person.weeklyCapacityHours) *
          4.33 *
          (1 - toNum(summary.nonbillablePct)),
      );

      await upsertSuggestion({
        personId: summary.personId,
        squadId: summary.squadId,
        month,
        suggestionType: "declaration_adjustment",
        explanation: `${person.name} spent ${pctDisplay}% of capacity on non-billable activities in ${monthLabel} (${hoursDisplay}h). This reduces effective billable availability.`,
        suggestedAction: `Review ${person.name}'s pool declarations for next month. Consider reducing total committed hours by ~${hoursDisplay}h to reflect actual availability.`,
        suggestedHours: suggested,
        currentHours: round2(toNum(summary.capacityHours)),
      });
    }
  }

  const squads = await prisma.squad.findMany({ select: { id: true, name: true } });
  const mEnd = monthEnd(month);

  for (const { id: squadId, name: squadName } of squads) {
    const ceremonyCats = await prisma.nonBillableCategory.findMany({
      where: { type: "shared_ceremony" },
      select: { id: true },
    });
    const ceremonyIds = ceremonyCats.map((c) => c.id);

    const ceremonyAgg = await prisma.nonBillableEntry.aggregate({
      where: { squadId, categoryId: { in: ceremonyIds }, date: { gte: month, lte: mEnd } },
      _sum: { hours: true },
    });
    const ceremonyHours = toNum(ceremonyAgg._sum.hours);

    const billableAgg = await prisma.hourRecord.aggregate({
      where: {
        person: { squadMemberships: { some: { squadId } } },
        date: { gte: month, lte: mEnd },
      },
      _sum: { hours: true },
    });
    const billableHours = toNum(billableAgg._sum.hours);

    if (billableHours > 0 && ceremonyHours > 0) {
      const ceremonyPct = ceremonyHours / billableHours;
      if (ceremonyPct > 0.15) {
        await upsertSuggestion({
          personId: null,
          squadId,
          month,
          suggestionType: "ceremony_overhead",
          explanation: `Squad ${squadName} spent ${ceremonyHours.toFixed(1)}h on ceremonies (${(ceremonyPct * 100).toFixed(0)}% of total capacity) in ${month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}.`,
          suggestedAction: `Review ceremony structure. Target <15% ceremony overhead. Current ceremonies are costing ~${ceremonyHours.toFixed(0)}h/month of client-facing capacity.`,
          suggestedHours: null,
          currentHours: round2(ceremonyHours),
        });
      }
    }
  }

  const monthsToCheck = [twoMonthsAgo, prior, month];
  const driftRows = await prisma.monthlyNonBillableSummary.findMany({
    where: { categoryType: null, month: { in: monthsToCheck } },
  });

  const byPerson: Record<number, Record<string, { pct: number; hours: number; squadId: number }>> = {};
  for (const row of driftRows) {
    if (!byPerson[row.personId]) byPerson[row.personId] = {};
    byPerson[row.personId][row.month.toISOString()] = {
      pct: toNum(row.nonbillablePct),
      hours: toNum(row.totalHours),
      squadId: row.squadId,
    };
  }

  for (const [personIdStr, monthData] of Object.entries(byPerson)) {
    const personId = Number(personIdStr);
    const keys = monthsToCheck.map((m) => m.toISOString());
    const pcts = keys.map((k) => monthData[k]?.pct).filter((p): p is number => p !== undefined);
    if (pcts.length < 3) continue;
    if (!pcts.every((p) => p > 0.15)) continue;

    const avgPct = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    const avgHours = keys
      .map((k) => monthData[k]?.hours ?? 0)
      .reduce((a, b) => a + b, 0) / pcts.length;

    const squadId = monthData[month.toISOString()]?.squadId ?? null;

    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: { name: true, weeklyCapacityHours: true },
    });
    if (!person) continue;

    const currentMonthly = round2(toNum(person.weeklyCapacityHours) * 4.33);
    const suggested = round2(currentMonthly * (1 - avgPct));

    await upsertSuggestion({
      personId,
      squadId,
      month,
      suggestionType: "nonbillable_trend",
      explanation: `${person.name} has averaged ${(avgPct * 100).toFixed(0)}% non-billable over the last 3 months (${avgHours.toFixed(1)}h/mo).`,
      suggestedAction: `Adjust ${person.name}'s default available hours from ${currentMonthly.toFixed(0)}h to ${suggested.toFixed(0)}h/mo in capacity planning. This brings declarations in line with actual delivery capacity.`,
      suggestedHours: suggested,
      currentHours: currentMonthly,
    });
  }
}

async function upsertSuggestion(data: {
  personId: number | null;
  squadId: number | null;
  month: Date;
  suggestionType: string;
  explanation: string;
  suggestedAction: string;
  suggestedHours: number | null;
  currentHours: number | null;
}): Promise<void> {
  const existing = await prisma.nonBillableEnhancementSuggestion.findFirst({
    where: {
      month: data.month,
      suggestionType: data.suggestionType as never,
      status: "open",
      personId: data.personId ?? null,
      ...(data.personId === null ? { squadId: data.squadId } : {}),
    },
  });

  if (existing) {
    await prisma.nonBillableEnhancementSuggestion.update({
      where: { id: existing.id },
      data: {
        explanation: data.explanation,
        suggestedAction: data.suggestedAction,
        suggestedHours: data.suggestedHours,
        currentHours: data.currentHours,
      },
    });
    return;
  }

  await prisma.nonBillableEnhancementSuggestion.create({
    data: {
      personId: data.personId,
      squadId: data.squadId,
      month: data.month,
      suggestionType: data.suggestionType as never,
      status: "open",
      explanation: data.explanation,
      suggestedAction: data.suggestedAction,
      suggestedHours: data.suggestedHours,
      currentHours: data.currentHours,
    },
  });
}

// ─── Burn Snapshots ───────────────────────────────────────────────────────────

async function refreshBurnSnapshots(month: Date): Promise<void> {
  const mEnd = monthEnd(month);
  const daysInMonth =
    Math.floor((mEnd.getTime() - month.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  const activeClients = await prisma.client.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const { id: clientId } of activeClients) {
    const contracts = await prisma.contract.findMany({
      where: {
        sow: { clientId },
        status: "active",
        startDate: { lte: month },
        OR: [{ endDate: null }, { endDate: { gte: month } }],
      },
      select: { assignedHours: true },
    });
    if (contracts.length === 0) continue;

    const poolHours = round2(
      contracts.reduce((s, c) => s + toNum(c.assignedHours), 0),
    );

    const weekStarts: Date[] = [];
    let ws = new Date(month);
    while (ws <= mEnd) {
      weekStarts.push(new Date(ws));
      ws = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    for (const weekStart of weekStarts) {
      const weekEnd = new Date(
        Math.min(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000, mEnd.getTime()),
      );

      const cumAgg = await prisma.hourRecord.aggregate({
        where: {
          clientId,
          budgetSource: "retainer",
          date: { gte: month, lte: weekEnd },
        },
        _sum: { hours: true },
      });
      const cumulativeHours = round2(toNum(cumAgg._sum.hours));

      const daysElapsed =
        Math.floor((weekEnd.getTime() - month.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      const expectedCumulative = round2(poolHours * (daysElapsed / daysInMonth));
      const burnRateRatio =
        expectedCumulative > 0 ? round4(cumulativeHours / expectedCumulative) : 0;
      const projectedEomHours =
        daysElapsed > 0 && cumulativeHours > 0
          ? round2((cumulativeHours / daysElapsed) * daysInMonth)
          : 0;

      let alertLevel: "safe" | "watch" | "warning" | "critical" = "safe";
      if (burnRateRatio > 1.2) alertLevel = "critical";
      else if (burnRateRatio > 1.1) alertLevel = "warning";
      else if (burnRateRatio > 1.05) alertLevel = "watch";

      let projectedExhaustionDate: Date | null = null;
      if (projectedEomHours > poolHours && cumulativeHours > 0 && daysElapsed > 0) {
        const dailyRate = cumulativeHours / daysElapsed;
        const daysToExhaustion = poolHours / dailyRate;
        projectedExhaustionDate = new Date(
          month.getTime() + daysToExhaustion * 24 * 60 * 60 * 1000,
        );
      }

      const snapshotData = {
        cumulativeHours,
        expectedCumulative,
        burnRateRatio,
        projectedEomHours,
        poolHours,
        alertLevel,
        projectedExhaustionDate,
      };

      const existing = await prisma.weeklyBurnSnapshot.findFirst({
        where: { clientId, weekStart, roleType: null },
        select: { id: true },
      });

      if (existing) {
        await prisma.weeklyBurnSnapshot.update({
          where: { id: existing.id },
          data: snapshotData,
        });
      } else {
        await prisma.weeklyBurnSnapshot.create({
          data: { clientId, weekStart, roleType: null, ...snapshotData },
        });
      }
    }
  }
}

// ─── Numeric helpers ──────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
