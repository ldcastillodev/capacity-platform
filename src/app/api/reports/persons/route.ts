import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const squadIdParam = searchParams.get("squadId");
  const employmentType = searchParams.get("employmentType");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 25)));

  const fromDate = from
    ? new Date(from)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const toDate = to ? new Date(to) : fromDate;

  const squadFilter = squadIdParam
    ? Prisma.sql`AND sm.squad_id = ${Number(squadIdParam)}`
    : Prisma.empty;

  const employmentFilter = employmentType
    ? Prisma.sql`AND p.employment_type::text = ${employmentType}`
    : Prisma.empty;

  // CROSS JOIN date_range dr comes before squad_memberships so dr is in scope for WHERE
  const dataRows = await prisma.$queryRaw<
    {
      person_id: number;
      person_name: string;
      employment_type: string;
      squad_id: number;
      squad_name: string;
      month: Date;
      billable_hours: string;
      nb_hours: string;
      capacity_hours: string;
      nb_pct: string;
    }[]
  >(Prisma.sql`
    WITH date_range AS (
      SELECT generate_series(
        DATE_TRUNC('month', ${fromDate}::date),
        DATE_TRUNC('month', ${toDate}::date),
        INTERVAL '1 month'
      )::date AS month
    ),
    person_months AS (
      SELECT DISTINCT
        p.id                    AS person_id,
        p.name                  AS person_name,
        p.employment_type::text AS employment_type,
        sm.squad_id,
        s.name                  AS squad_name,
        dr.month
      FROM persons p
      CROSS JOIN date_range dr
      JOIN squad_memberships sm ON sm.person_id = p.id
      JOIN squads s ON s.id = sm.squad_id
      WHERE p.is_active = true
        AND sm.effective_from <= (dr.month + INTERVAL '1 month' - INTERVAL '1 day')::date
        AND (sm.effective_to IS NULL OR sm.effective_to >= dr.month)
        ${squadFilter}
        ${employmentFilter}
    )
    SELECT
      pm.person_id,
      pm.person_name,
      pm.employment_type,
      pm.squad_id,
      pm.squad_name,
      pm.month,
      COALESCE(SUM(hr.hours), 0)::text     AS billable_hours,
      COALESCE(nb.total_hours, 0)::text    AS nb_hours,
      COALESCE(nb.capacity_hours, 0)::text AS capacity_hours,
      COALESCE(nb.nonbillable_pct, 0)::text AS nb_pct
    FROM person_months pm
    LEFT JOIN hour_records hr
      ON hr.person_id = pm.person_id
      AND DATE_TRUNC('month', hr.date) = pm.month
    LEFT JOIN monthly_nonbillable_summaries nb
      ON nb.person_id = pm.person_id
      AND nb.squad_id = pm.squad_id
      AND nb.month = pm.month
      AND nb.category_type IS NULL
    GROUP BY
      pm.person_id, pm.person_name, pm.employment_type,
      pm.squad_id, pm.squad_name, pm.month,
      nb.total_hours, nb.capacity_hours, nb.nonbillable_pct
    ORDER BY pm.person_name, pm.month
  `);

  const total = dataRows.length;
  const data = dataRows.slice((page - 1) * pageSize, page * pageSize).map((r) => ({
    ...r,
    month: r.month instanceof Date ? r.month.toISOString() : r.month,
  }));

  return NextResponse.json({
    data,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
