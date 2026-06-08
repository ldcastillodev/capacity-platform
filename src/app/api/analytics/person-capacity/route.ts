import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const monthDate = month
    ? new Date(month)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0));

  const rows = await prisma.$queryRaw<
    {
      person_id: number;
      person_name: string;
      squad_names: string;
      capacity_hours: number;
      actual_hours: number;
      utilisation_pct: number;
    }[]
  >(Prisma.sql`
    WITH workdays AS (
      SELECT COUNT(*)::numeric AS cnt
      FROM generate_series(${monthDate}::date, ${monthEnd}::date, '1 day'::interval) d
      WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
    ),
    person_squads AS (
      SELECT
        sm.person_id,
        STRING_AGG(s.name, ', ' ORDER BY s.name) AS squad_names
      FROM squad_memberships sm
      JOIN squads s ON s.id = sm.squad_id AND s.is_active = true
      WHERE sm.effective_from <= ${monthEnd}::date
        AND (sm.effective_to IS NULL OR sm.effective_to >= ${monthDate}::date)
      GROUP BY sm.person_id
    ),
    actual AS (
      SELECT hr.person_id, SUM(hr.hours) AS actual_hours
      FROM hour_records hr
      WHERE hr.date >= ${monthDate}::date
        AND hr.date <= ${monthEnd}::date
      GROUP BY hr.person_id
    )
    SELECT
      p.id   AS person_id,
      p.name AS person_name,
      COALESCE(ps.squad_names, '—') AS squad_names,
      (p.weekly_capacity_hours * (SELECT cnt FROM workdays) / 5.0)::float AS capacity_hours,
      COALESCE(a.actual_hours, 0)::float AS actual_hours,
      CASE WHEN p.weekly_capacity_hours > 0
           THEN (COALESCE(a.actual_hours, 0) / (p.weekly_capacity_hours * (SELECT cnt FROM workdays) / 5.0) * 100)::float
           ELSE 0::float
      END AS utilisation_pct
    FROM persons p
    LEFT JOIN person_squads ps ON ps.person_id = p.id
    LEFT JOIN actual a ON a.person_id = p.id
    WHERE p.is_active = true
    ORDER BY p.name
  `);

  return NextResponse.json(rows);
}
