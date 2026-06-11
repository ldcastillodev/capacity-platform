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
      member_count: number;
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
    -- Capacity effective for the queried month, pro-rated by days when it
    -- changed mid-month. Membership window (not is_active today) decides
    -- who counts for a historical month.
    pcap AS (
      SELECT
        pch.person_id,
        SUM(
          pch.weekly_capacity_hours *
          (LEAST(COALESCE(pch.effective_to, ${monthEnd}::date), ${monthEnd}::date)
           - GREATEST(pch.effective_from, ${monthDate}::date) + 1)
        )::numeric / (${monthEnd}::date - ${monthDate}::date + 1) AS weekly_capacity
      FROM person_capacity_history pch
      WHERE pch.effective_from <= ${monthEnd}::date
        AND (pch.effective_to IS NULL OR pch.effective_to >= ${monthDate}::date)
      GROUP BY pch.person_id
    ),
    capacity AS (
      SELECT
        sm.squad_id,
        COUNT(DISTINCT sm.person_id)::int AS member_count,
        SUM(pc.weekly_capacity * sm.allocation_pct * (SELECT cnt FROM workdays) / 5.0) AS capacity_hours
      FROM squad_memberships sm
      JOIN pcap pc ON pc.person_id = sm.person_id
      WHERE sm.effective_from <= ${monthEnd}::date
        AND (sm.effective_to IS NULL OR sm.effective_to >= ${monthDate}::date)
      GROUP BY sm.squad_id
    ),
    actual AS (
      SELECT hr.squad_id, SUM(hr.hours) AS actual_hours
      FROM hour_records hr
      WHERE hr.date >= ${monthDate}::date
        AND hr.date <= ${monthEnd}::date
      GROUP BY hr.squad_id
    )
    SELECT
      s.id   AS squad_id,
      s.name AS squad_name,
      COALESCE(c.member_count, 0)::int             AS member_count,
      COALESCE(c.capacity_hours, 0)::float         AS capacity_hours,
      COALESCE(a.actual_hours, 0)::float           AS actual_hours,
      CASE WHEN COALESCE(c.capacity_hours, 0) > 0
           THEN (COALESCE(a.actual_hours, 0) / c.capacity_hours * 100)::float
           ELSE 0::float
      END AS utilisation_pct
    FROM squads s
    LEFT JOIN capacity c ON c.squad_id = s.id
    LEFT JOIN actual a ON a.squad_id = s.id
    WHERE s.is_active = true
    ORDER BY s.name
  `);

  return NextResponse.json(rows);
}
