import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const squadIdParam = searchParams.get("squadId");
  const roleType = searchParams.get("roleType");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 25)));

  const fromDate = from
    ? new Date(from)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const toDate = to ? new Date(to) : fromDate;

  const squadFilter = squadIdParam
    ? Prisma.sql`AND s.id = ${Number(squadIdParam)}`
    : Prisma.empty;

  const roleFilter = roleType
    ? Prisma.sql`AND hr.role_type::text = ${roleType}`
    : Prisma.empty;

  const roleFilterNb = roleType
    ? Prisma.sql`AND false` // NB entries have no role_type; show 0 when filtering by role
    : Prisma.empty;

  const dataRows = await prisma.$queryRaw<
    {
      squad_id: number;
      squad_name: string;
      month: Date;
      billable_hours: string;
      nb_hours: string;
      capacity_hours: string;
    }[]
  >(Prisma.sql`
    WITH date_range AS (
      SELECT generate_series(
        DATE_TRUNC('month', ${fromDate}::date),
        DATE_TRUNC('month', ${toDate}::date),
        INTERVAL '1 month'
      )::date AS month
    ),
    squad_months AS (
      SELECT DISTINCT s.id AS squad_id, s.name AS squad_name, dr.month
      FROM squads s
      CROSS JOIN date_range dr
      WHERE s.is_active = true
        ${squadFilter}
    ),
    squad_members AS (
      SELECT DISTINCT
        sm2.squad_id,
        sm2.person_id,
        p.weekly_capacity_hours,
        dr2.month
      FROM squad_memberships sm2
      JOIN persons p ON p.id = sm2.person_id AND p.is_active = true
      CROSS JOIN date_range dr2
      WHERE sm2.effective_from <= (dr2.month + INTERVAL '1 month' - INTERVAL '1 day')::date
        AND (sm2.effective_to IS NULL OR sm2.effective_to >= dr2.month)
    ),
    capacity_calc AS (
      SELECT
        mem.squad_id,
        mem.month,
        SUM(
          mem.weekly_capacity_hours *
          (SELECT COUNT(*)::numeric
           FROM generate_series(mem.month, (mem.month + INTERVAL '1 month' - INTERVAL '1 day')::date, '1 day'::interval) d
           WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)) / 5.0
        ) AS capacity_hours
      FROM squad_members mem
      GROUP BY mem.squad_id, mem.month
    )
    SELECT
      sm3.squad_id,
      sm3.squad_name,
      sm3.month,
      COALESCE((
        SELECT SUM(hr.hours)
        FROM squad_members mem2
        JOIN hour_records hr ON hr.person_id = mem2.person_id
          AND DATE_TRUNC('month', hr.date) = sm3.month
          AND hr.is_non_billable = false
          ${roleFilter}
        WHERE mem2.squad_id = sm3.squad_id AND mem2.month = sm3.month
      ), 0)::text AS billable_hours,
      COALESCE((
        SELECT SUM(hr2.hours)
        FROM squad_members mem3
        JOIN hour_records hr2 ON hr2.person_id = mem3.person_id
          AND DATE_TRUNC('month', hr2.date) = sm3.month
          AND hr2.is_non_billable = true
          ${roleFilterNb}
        WHERE mem3.squad_id = sm3.squad_id AND mem3.month = sm3.month
      ), 0)::text AS nb_hours,
      COALESCE(cc.capacity_hours, 0)::text AS capacity_hours
    FROM squad_months sm3
    LEFT JOIN capacity_calc cc ON cc.squad_id = sm3.squad_id AND cc.month = sm3.month
    ORDER BY sm3.squad_name, sm3.month
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
