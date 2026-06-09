import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type GroupBy = "person" | "squad" | "client" | "contract" | "role" | "month";
type Billability = "all" | "billable" | "nonbillable";

const GROUP_BYS: GroupBy[] = ["person", "squad", "client", "contract", "role", "month"];

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

function parseStrings(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// group_key (stable id) and group_label (display) expressions over the hour_records query
function actualGroupExpr(groupBy: GroupBy): { key: Prisma.Sql; label: Prisma.Sql } {
  switch (groupBy) {
    case "person":
      return { key: Prisma.sql`hr.person_id::text`, label: Prisma.sql`p.name` };
    case "squad":
      return { key: Prisma.sql`hr.squad_id::text`, label: Prisma.sql`s.name` };
    case "client":
      return {
        key: Prisma.sql`COALESCE(hr.client_id::text, 'unassigned')`,
        label: Prisma.sql`COALESCE(cl.name, 'Unassigned')`,
      };
    case "contract":
      return {
        key: Prisma.sql`COALESCE(hr.contract_id::text, 'unassigned')`,
        label: Prisma.sql`COALESCE(c.name, 'Unassigned')`,
      };
    case "role":
      return {
        key: Prisma.sql`COALESCE(hr.role_type::text, 'unassigned')`,
        label: Prisma.sql`COALESCE(hr.role_type::text, 'unassigned')`,
      };
    case "month":
      return {
        key: Prisma.sql`DATE_TRUNC('month', hr.date)::date::text`,
        label: Prisma.sql`DATE_TRUNC('month', hr.date)::date::text`,
      };
  }
}

// group_key expression over the declarations query (planned hours)
function declGroupKey(groupBy: GroupBy): Prisma.Sql {
  switch (groupBy) {
    case "squad":
      return Prisma.sql`mrd.squad_id::text`;
    case "client":
      return Prisma.sql`COALESCE(mrd.client_id::text, 'unassigned')`;
    case "contract":
      return Prisma.sql`COALESCE(mrd.contract_id::text, 'unassigned')`;
    case "role":
      return Prisma.sql`der.role_type::text`;
    case "month":
      return Prisma.sql`DATE_TRUNC('month', mrd.month)::date::text`;
    default:
      return Prisma.sql`'unassigned'`;
  }
}

function monthIso(month: Date | string): string {
  return month instanceof Date ? month.toISOString().slice(0, 10) : String(month).slice(0, 10);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const groupByParam = searchParams.get("groupBy") as GroupBy | null;
  const groupBy: GroupBy = groupByParam && GROUP_BYS.includes(groupByParam) ? groupByParam : "squad";
  const billability = (searchParams.get("billability") as Billability | null) ?? "all";

  const personIds = parseIds(searchParams.get("personIds"));
  const squadIds = parseIds(searchParams.get("squadIds"));
  const clientIds = parseIds(searchParams.get("clientIds"));
  const contractIds = parseIds(searchParams.get("contractIds"));
  const sowIds = parseIds(searchParams.get("sowIds"));
  const roleTypes = parseStrings(searchParams.get("roleTypes"));

  const now = new Date();
  const fromDate = from
    ? new Date(from)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  const toDate = to
    ? new Date(to)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const toMonthEnd = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth() + 1, 0));

  // ── Shared hour_records filters ────────────────────────────────────────────
  const hrFilters: Prisma.Sql[] = [
    Prisma.sql`hr.date >= ${fromDate}::date`,
    Prisma.sql`hr.date <= ${toMonthEnd}::date`,
  ];
  if (billability === "billable") hrFilters.push(Prisma.sql`hr.is_non_billable = false`);
  if (billability === "nonbillable") hrFilters.push(Prisma.sql`hr.is_non_billable = true`);
  if (personIds.length) hrFilters.push(Prisma.sql`hr.person_id IN (${Prisma.join(personIds)})`);
  if (squadIds.length) hrFilters.push(Prisma.sql`hr.squad_id IN (${Prisma.join(squadIds)})`);
  if (clientIds.length) hrFilters.push(Prisma.sql`hr.client_id IN (${Prisma.join(clientIds)})`);
  if (contractIds.length) hrFilters.push(Prisma.sql`hr.contract_id IN (${Prisma.join(contractIds)})`);
  if (sowIds.length) hrFilters.push(Prisma.sql`c.sow_id IN (${Prisma.join(sowIds)})`);
  if (roleTypes.length) hrFilters.push(Prisma.sql`hr.role_type::text IN (${Prisma.join(roleTypes)})`);
  const hrWhere = Prisma.join(hrFilters, " AND ");

  const { key: groupKey, label: groupLabel } = actualGroupExpr(groupBy);

  const actualRows = await prisma.$queryRaw<
    {
      group_key: string;
      group_label: string;
      month: Date;
      billable_hours: number;
      nb_hours: number;
    }[]
  >(Prisma.sql`
    SELECT
      ${groupKey}                                       AS group_key,
      ${groupLabel}                                     AS group_label,
      DATE_TRUNC('month', hr.date)::date                AS month,
      SUM(CASE WHEN hr.is_non_billable = false THEN hr.hours ELSE 0 END)::float AS billable_hours,
      SUM(CASE WHEN hr.is_non_billable = true  THEN hr.hours ELSE 0 END)::float AS nb_hours
    FROM hour_records hr
    LEFT JOIN persons p   ON p.id  = hr.person_id
    LEFT JOIN squads s    ON s.id  = hr.squad_id
    LEFT JOIN clients cl  ON cl.id = hr.client_id
    LEFT JOIN contracts c ON c.id  = hr.contract_id
    WHERE ${hrWhere}
    GROUP BY group_key, group_label, DATE_TRUNC('month', hr.date)::date
    ORDER BY group_label, month
  `);

  // ── Planned (declared) hours ───────────────────────────────────────────────
  const plannedApplicable =
    groupBy !== "person" && personIds.length === 0 && billability !== "nonbillable";

  const plannedByCell = new Map<string, number>(); // `${group_key}|${monthIso}` → hours
  const plannedByMonth = new Map<string, number>(); // monthIso → hours
  let plannedTotal = 0;

  if (plannedApplicable) {
    const declFilters: Prisma.Sql[] = [
      Prisma.sql`mrd.status = 'confirmed'`,
      Prisma.sql`mrd.month >= ${fromDate}::date`,
      Prisma.sql`mrd.month <= ${toDate}::date`,
    ];
    if (clientIds.length) declFilters.push(Prisma.sql`mrd.client_id IN (${Prisma.join(clientIds)})`);
    if (squadIds.length) declFilters.push(Prisma.sql`mrd.squad_id IN (${Prisma.join(squadIds)})`);
    if (contractIds.length) declFilters.push(Prisma.sql`mrd.contract_id IN (${Prisma.join(contractIds)})`);
    if (sowIds.length) declFilters.push(Prisma.sql`c.sow_id IN (${Prisma.join(sowIds)})`);
    if (roleTypes.length) declFilters.push(Prisma.sql`der.role_type::text IN (${Prisma.join(roleTypes)})`);
    const declWhere = Prisma.join(declFilters, " AND ");

    const plannedRows = await prisma.$queryRaw<
      { group_key: string; month: Date; planned_hours: number }[]
    >(Prisma.sql`
      SELECT
        ${declGroupKey(groupBy)}                  AS group_key,
        DATE_TRUNC('month', mrd.month)::date      AS month,
        SUM(der.declared_hours)::float            AS planned_hours
      FROM monthly_role_declarations mrd
      JOIN declaration_role_entries der ON der.declaration_id = mrd.id
      LEFT JOIN contracts c ON c.id = mrd.contract_id
      WHERE ${declWhere}
      GROUP BY group_key, DATE_TRUNC('month', mrd.month)::date
    `);

    for (const r of plannedRows) {
      const mIso = monthIso(r.month);
      plannedByCell.set(`${r.group_key}|${mIso}`, r.planned_hours);
      plannedByMonth.set(mIso, (plannedByMonth.get(mIso) ?? 0) + r.planned_hours);
      plannedTotal += r.planned_hours;
    }
  }

  // ── Table rows ─────────────────────────────────────────────────────────────
  const rows = actualRows.map((r) => {
    const mIso = monthIso(r.month);
    const planned = plannedApplicable ? plannedByCell.get(`${r.group_key}|${mIso}`) ?? 0 : null;
    const utilizationPct = planned && planned > 0 ? r.billable_hours / planned : null;
    return {
      key: `${r.group_key}|${mIso}`,
      groupKey: r.group_key,
      label: r.group_label,
      month: mIso,
      billableHours: r.billable_hours,
      nonBillableHours: r.nb_hours,
      plannedHours: planned,
      utilizationPct,
    };
  });

  // ── Chart series: per-month billable / non-billable / planned ──────────────
  const byMonth = new Map<string, { billable: number; nonBillable: number }>();
  for (const r of actualRows) {
    const mIso = monthIso(r.month);
    const acc = byMonth.get(mIso) ?? { billable: 0, nonBillable: 0 };
    acc.billable += r.billable_hours;
    acc.nonBillable += r.nb_hours;
    byMonth.set(mIso, acc);
  }
  const monthKeys = new Set<string>([...byMonth.keys(), ...plannedByMonth.keys()]);
  const series = [...monthKeys]
    .sort()
    .map((mIso) => ({
      month: mIso,
      billable: byMonth.get(mIso)?.billable ?? 0,
      nonBillable: byMonth.get(mIso)?.nonBillable ?? 0,
      planned: plannedApplicable ? plannedByMonth.get(mIso) ?? 0 : null,
    }));

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const billableHours = actualRows.reduce((s, r) => s + r.billable_hours, 0);
  const nonBillableHours = actualRows.reduce((s, r) => s + r.nb_hours, 0);
  const kpis = {
    totalHours: billableHours + nonBillableHours,
    billableHours,
    nonBillableHours,
    plannedHours: plannedApplicable ? plannedTotal : null,
    utilizationPct: plannedApplicable && plannedTotal > 0 ? billableHours / plannedTotal : null,
  };

  return NextResponse.json({ kpis, series, rows, groupBy });
}
