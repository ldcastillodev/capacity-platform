import { NextRequest, NextResponse } from "next/server";
import { reportsService } from "@/lib/db";
import { getMonthRange } from "@/lib/temporal";
import { Prisma } from "@prisma/client";

type Dimension =
  | "person"
  | "squad"
  | "client"
  | "sow"
  | "contract"
  | "role"
  | "billability"
  | "ticket"
  | "month"
  | "week"
  | "day";
type Granularity = "day" | "week" | "month";
type Billability = "all" | "billable" | "nonbillable";

const MAX_DIMENSIONS = 4;

// key (stable id) and label (display) expressions over the hour_records query.
// Hardcoded fragments only — user input is never interpolated.
const DIMENSIONS: Record<Dimension, { key: Prisma.Sql; label: Prisma.Sql }> = {
  person: { key: Prisma.sql`hr.person_id::text`, label: Prisma.sql`p.name` },
  squad: { key: Prisma.sql`hr.squad_id::text`, label: Prisma.sql`s.name` },
  client: {
    key: Prisma.sql`COALESCE(hr.client_id::text, 'unassigned')`,
    label: Prisma.sql`COALESCE(cl.name, 'Unassigned')`,
  },
  sow: {
    key: Prisma.sql`COALESCE(c.sow_id::text, 'unassigned')`,
    label: Prisma.sql`COALESCE(sw.name, 'Unassigned')`,
  },
  contract: {
    key: Prisma.sql`COALESCE(hr.contract_id::text, 'unassigned')`,
    label: Prisma.sql`COALESCE(c.name, 'Unassigned')`,
  },
  role: {
    key: Prisma.sql`COALESCE(hr.role_type::text, 'unassigned')`,
    label: Prisma.sql`COALESCE(hr.role_type::text, 'unassigned')`,
  },
  billability: {
    key: Prisma.sql`hr.is_non_billable::text`,
    label: Prisma.sql`CASE WHEN hr.is_non_billable THEN 'Non-Billable' ELSE 'Billable' END`,
  },
  ticket: {
    key: Prisma.sql`COALESCE(hr.issue_key, 'No ticket')`,
    label: Prisma.sql`COALESCE(hr.issue_key, 'No ticket')`,
  },
  month: {
    key: Prisma.sql`DATE_TRUNC('month', hr.date)::date::text`,
    label: Prisma.sql`DATE_TRUNC('month', hr.date)::date::text`,
  },
  week: {
    key: Prisma.sql`DATE_TRUNC('week', hr.date)::date::text`,
    label: Prisma.sql`DATE_TRUNC('week', hr.date)::date::text`,
  },
  day: {
    key: Prisma.sql`hr.date::date::text`,
    label: Prisma.sql`hr.date::date::text`,
  },
};

const GRANULARITY_EXPR: Record<Granularity, Prisma.Sql> = {
  day: Prisma.sql`hr.date::date::text`,
  week: Prisma.sql`DATE_TRUNC('week', hr.date)::date::text`,
  month: Prisma.sql`DATE_TRUNC('month', hr.date)::date::text`,
};

function parseDimensions(raw: string | null): Dimension[] {
  const valid = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Dimension => s in DIMENSIONS);
  const deduped = [...new Set(valid)].slice(0, MAX_DIMENSIONS);
  return deduped.length > 0 ? deduped : ["squad"];
}

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

function parseStrings(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const dimensions = parseDimensions(searchParams.get("dimensions"));
  const granularityParam = searchParams.get("granularity") as Granularity | null;
  const granularity: Granularity =
    granularityParam && granularityParam in GRANULARITY_EXPR ? granularityParam : "month";
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
  const toDate = to ? new Date(to) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const toMonthEnd = getMonthRange(toDate).end;

  // ── Shared hour_records filters ────────────────────────────────────────────
  const hrFilters: Prisma.Sql[] = [
    Prisma.sql`hr.date >= ${fromDate}::date`,
    Prisma.sql`hr.date <= ${toMonthEnd}::date`,
    Prisma.sql`hr.archived_at IS NULL`,
  ];
  if (billability === "billable") hrFilters.push(Prisma.sql`hr.is_non_billable = false`);
  if (billability === "nonbillable") hrFilters.push(Prisma.sql`hr.is_non_billable = true`);
  if (personIds.length) hrFilters.push(Prisma.sql`hr.person_id IN (${Prisma.join(personIds)})`);
  if (squadIds.length) hrFilters.push(Prisma.sql`hr.squad_id IN (${Prisma.join(squadIds)})`);
  if (clientIds.length) hrFilters.push(Prisma.sql`hr.client_id IN (${Prisma.join(clientIds)})`);
  if (contractIds.length)
    hrFilters.push(Prisma.sql`hr.contract_id IN (${Prisma.join(contractIds)})`);
  if (sowIds.length) hrFilters.push(Prisma.sql`c.sow_id IN (${Prisma.join(sowIds)})`);
  if (roleTypes.length)
    hrFilters.push(Prisma.sql`hr.role_type::text IN (${Prisma.join(roleTypes)})`);
  const hrWhere = Prisma.join(hrFilters, " AND ");

  const fromJoins = Prisma.sql`
    FROM hour_records hr
    LEFT JOIN persons p   ON p.id  = hr.person_id
    LEFT JOIN squads s    ON s.id  = hr.squad_id
    LEFT JOIN clients cl  ON cl.id = hr.client_id
    LEFT JOIN contracts c ON c.id  = hr.contract_id
    LEFT JOIN statements_of_work sw ON sw.id = c.sow_id
  `;

  // ── Table rows: flat GROUP BY over the selected dimensions ────────────────
  const dimSelect = Prisma.join(
    dimensions.map(
      (d, i) =>
        Prisma.sql`${DIMENSIONS[d].key} AS ${Prisma.raw(`d${i}_key`)}, ${DIMENSIONS[d].label} AS ${Prisma.raw(`d${i}_label`)}`
    ),
    ", "
  );
  const dimAliases = dimensions.flatMap((_, i) => [`d${i}_key`, `d${i}_label`]).join(", ");
  const labelAliases = dimensions.map((_, i) => `d${i}_label`).join(", ");

  const actualRows = await reportsService.getHoursReportRows({
    dimSelect,
    fromJoins,
    hrWhere,
    dimAliases,
    labelAliases,
  });

  const rows = actualRows.map((r) => {
    const labels: Record<string, string> = {};
    const keyParts: string[] = [];
    dimensions.forEach((d, i) => {
      keyParts.push(String(r[`d${i}_key`]));
      labels[d] = String(r[`d${i}_label`]);
    });
    return {
      key: keyParts.join("|"),
      labels,
      billableHours: Number(r.billable_hours),
      nonBillableHours: Number(r.nb_hours),
    };
  });

  // ── Chart series: per-period billable / non-billable ───────────────────────
  const seriesRows = await reportsService.getHoursReportSeries({
    periodExpr: GRANULARITY_EXPR[granularity],
    fromJoins,
    hrWhere,
  });

  const series = seriesRows.map((r) => ({
    period: r.period,
    billable: r.billable,
    nonBillable: r.non_billable,
  }));

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const billableHours = series.reduce((s, r) => s + r.billable, 0);
  const nonBillableHours = series.reduce((s, r) => s + r.nonBillable, 0);
  const kpis = {
    totalHours: billableHours + nonBillableHours,
    billableHours,
    nonBillableHours,
  };

  return NextResponse.json({ kpis, series, rows, dimensions, granularity });
}
