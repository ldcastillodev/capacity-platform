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
      squad_id: number;
      squad_name: string;
      total_hours: number;
      capacity_hours: number;
      nb_pct: number;
    }[]
  >(Prisma.sql`
    WITH nb AS (
      SELECT hr.squad_id, SUM(hr.hours) AS total_nb_hours
      FROM hour_records hr
      WHERE hr.is_non_billable = true
        AND hr.date >= ${monthDate}::date
        AND hr.date <= ${monthEnd}::date
      GROUP BY hr.squad_id
    ),
    capacity AS (
      SELECT
        sm.squad_id,
        SUM(
          p.weekly_capacity_hours * (
            SELECT COUNT(*)::numeric
            FROM generate_series(${monthDate}::date, ${monthEnd}::date, '1 day'::interval) d
            WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
          ) / 5.0
        ) AS capacity_hours
      FROM squad_memberships sm
      JOIN persons p ON p.id = sm.person_id AND p.is_active = true
      WHERE sm.effective_from <= ${monthEnd}::date
        AND (sm.effective_to IS NULL OR sm.effective_to >= ${monthDate}::date)
      GROUP BY sm.squad_id
    )
    SELECT
      s.id   AS squad_id,
      s.name AS squad_name,
      COALESCE(nb.total_nb_hours, 0)::float AS total_hours,
      COALESCE(c.capacity_hours, 0)::float  AS capacity_hours,
      CASE WHEN COALESCE(c.capacity_hours, 0) > 0
           THEN (COALESCE(nb.total_nb_hours, 0) / c.capacity_hours)::float
           ELSE 0::float
      END AS nb_pct
    FROM squads s
    LEFT JOIN nb ON nb.squad_id = s.id
    LEFT JOIN capacity c ON c.squad_id = s.id
    WHERE s.is_active = true
      AND (nb.total_nb_hours IS NOT NULL OR c.capacity_hours IS NOT NULL)
    ORDER BY s.name
  `);

  return NextResponse.json(rows);
}
