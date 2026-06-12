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

  // One row per squad-member for the month (empty squads keep one row with
  // null person fields).
  // Billable hours follow hr.squad_id (client work is squad-specific).
  // Non-billable hours are not squad-specific, so a person's monthly NB
  // total is split across their squads by allocation share — a 50/50
  // person shows half their NB in each squad. People with NB hours but no
  // membership keep NB at the recorded squad.
  const rows = await prisma.$queryRaw<
    {
      squad_id: number;
      squad_name: string;
      person_id: number | null;
      person_name: string | null;
      capacity_hours: number;
      billable_hours: number;
      nonbillable_hours: number;
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
    member AS (
      SELECT sm.squad_id, sm.person_id, SUM(sm.allocation_pct) AS alloc
      FROM squad_memberships sm
      WHERE sm.effective_from <= ${monthEnd}::date
        AND (sm.effective_to IS NULL OR sm.effective_to >= ${monthDate}::date)
      GROUP BY sm.squad_id, sm.person_id
    ),
    alloc_total AS (
      SELECT person_id, SUM(alloc) AS total_alloc FROM member GROUP BY person_id
    ),
    billable AS (
      SELECT hr.squad_id, hr.person_id, SUM(hr.hours) AS billable_hours
      FROM hour_records hr
      WHERE hr.date >= ${monthDate}::date
        AND hr.date <= ${monthEnd}::date
        AND NOT hr.is_non_billable
      GROUP BY hr.squad_id, hr.person_id
    ),
    nb_total AS (
      SELECT hr.person_id, SUM(hr.hours) AS nb_hours
      FROM hour_records hr
      WHERE hr.date >= ${monthDate}::date
        AND hr.date <= ${monthEnd}::date
        AND hr.is_non_billable
      GROUP BY hr.person_id
    ),
    -- NB fallback for people with no membership window: keep recorded squad.
    nb_recorded AS (
      SELECT hr.squad_id, hr.person_id, SUM(hr.hours) AS nb_hours
      FROM hour_records hr
      WHERE hr.date >= ${monthDate}::date
        AND hr.date <= ${monthEnd}::date
        AND hr.is_non_billable
        AND NOT EXISTS (SELECT 1 FROM alloc_total at WHERE at.person_id = hr.person_id)
      GROUP BY hr.squad_id, hr.person_id
    ),
    roster AS (
      SELECT squad_id, person_id FROM member
      UNION
      SELECT squad_id, person_id FROM billable
      UNION
      SELECT squad_id, person_id FROM nb_recorded
    )
    SELECT
      s.id   AS squad_id,
      s.name AS squad_name,
      p.id   AS person_id,
      p.name AS person_name,
      (COALESCE(pc.weekly_capacity, 0) * COALESCE(m.alloc, 0) * (SELECT cnt FROM workdays) / 5.0)::float AS capacity_hours,
      COALESCE(b.billable_hours, 0)::float AS billable_hours,
      (CASE
        WHEN m.alloc IS NOT NULL AND at.total_alloc > 0
          THEN COALESCE(nt.nb_hours, 0) * m.alloc / at.total_alloc
        ELSE COALESCE(nr.nb_hours, 0)
      END)::float AS nonbillable_hours
    FROM squads s
    LEFT JOIN roster r ON r.squad_id = s.id
    LEFT JOIN persons p ON p.id = r.person_id
    LEFT JOIN member m ON m.squad_id = r.squad_id AND m.person_id = r.person_id
    LEFT JOIN alloc_total at ON at.person_id = r.person_id
    LEFT JOIN pcap pc ON pc.person_id = r.person_id
    LEFT JOIN billable b ON b.squad_id = r.squad_id AND b.person_id = r.person_id
    LEFT JOIN nb_total nt ON nt.person_id = r.person_id
    LEFT JOIN nb_recorded nr ON nr.squad_id = r.squad_id AND nr.person_id = r.person_id
    WHERE s.is_active = true
    ORDER BY s.name, p.name
  `);

  return NextResponse.json(rows);
}
