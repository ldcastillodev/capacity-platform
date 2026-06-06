import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const squadIdParam = searchParams.get("squadId");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 25)));

  const fromDate = from
    ? new Date(from)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const toDate = to ? new Date(to) : fromDate;
  const toMonthEnd = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth() + 1, 0));

  const squadFilter = squadIdParam
    ? Prisma.sql`AND sm.squad_id = ${Number(squadIdParam)}`
    : Prisma.empty;

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
        p.id   AS person_id,
        p.name AS person_name,
        ''::text AS employment_type,
        sm.squad_id,
        s.name AS squad_name,
        dr.month
      FROM persons p
      CROSS JOIN date_range dr
      JOIN squad_memberships sm ON sm.person_id = p.id
      JOIN squads s ON s.id = sm.squad_id
      WHERE p.is_active = true
        AND sm.effective_from <= (dr.month + INTERVAL '1 month' - INTERVAL '1 day')::date
        AND (sm.effective_to IS NULL OR sm.effective_to >= dr.month)
        ${squadFilter}
    ),
    capacity_calc AS (
      SELECT
        pm2.person_id,
        pm2.month,
        p2.weekly_capacity_hours * (
          SELECT COUNT(*)::numeric
          FROM generate_series(
            pm2.month,
            (pm2.month + INTERVAL '1 month' - INTERVAL '1 day')::date,
            '1 day'::interval
          ) d
          WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
        ) / 5.0 AS capacity_hours
      FROM (SELECT DISTINCT person_id, month FROM person_months) pm2
      JOIN persons p2 ON p2.id = pm2.person_id
    ),
    nb_hours AS (
      SELECT
        hr.person_id,
        DATE_TRUNC('month', hr.date)::date AS month,
        SUM(hr.hours) AS total_nb_hours
      FROM hour_records hr
      WHERE hr.is_non_billable = true
        AND hr.date >= ${fromDate}::date
        AND hr.date <= ${toMonthEnd}::date
      GROUP BY hr.person_id, DATE_TRUNC('month', hr.date)::date
    )
    SELECT
      pm.person_id,
      pm.person_name,
      pm.employment_type,
      pm.squad_id,
      pm.squad_name,
      pm.month,
      COALESCE(SUM(hr.hours), 0)::text AS billable_hours,
      COALESCE(nb.total_nb_hours, 0)::text AS nb_hours,
      COALESCE(cc.capacity_hours, 0)::text AS capacity_hours,
      CASE WHEN COALESCE(cc.capacity_hours, 0) > 0
           THEN (COALESCE(nb.total_nb_hours, 0) / cc.capacity_hours)::text
           ELSE '0'::text
      END AS nb_pct
    FROM person_months pm
    LEFT JOIN hour_records hr
      ON hr.person_id = pm.person_id
      AND DATE_TRUNC('month', hr.date) = pm.month
      AND hr.is_non_billable = false
    LEFT JOIN capacity_calc cc ON cc.person_id = pm.person_id AND cc.month = pm.month
    LEFT JOIN nb_hours nb ON nb.person_id = pm.person_id AND nb.month = pm.month
    GROUP BY
      pm.person_id, pm.person_name, pm.employment_type,
      pm.squad_id, pm.squad_name, pm.month,
      cc.capacity_hours, nb.total_nb_hours
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
