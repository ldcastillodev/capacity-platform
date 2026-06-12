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

  // One row per (squad, role) for the month. A role appears if it has
  // capacity (members holding it), declarations, or hours.
  // Billable hours follow hr.role_type (stamped at sync). Non-billable
  // records carry no role_type, so a person's monthly NB total is
  // attributed to their active role(s) and split across squads by
  // allocation share.
  // Caveat: a person holding two roles concurrently counts full capacity
  // and NB under each role — per-role figures are indicative, not
  // partitioned.
  const rows = await prisma.$queryRaw<
    {
      squad_id: number;
      squad_name: string;
      role_type: string;
      capacity_hours: number;
      declared_hours: number;
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
    -- changed mid-month.
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
    active_role AS (
      SELECT pr.person_id, pr.role_type::text AS role_type
      FROM person_roles pr
      WHERE pr.effective_from <= ${monthEnd}::date
        AND (pr.effective_to IS NULL OR pr.effective_to >= ${monthDate}::date)
      GROUP BY pr.person_id, pr.role_type
    ),
    role_capacity AS (
      SELECT
        m.squad_id,
        ar.role_type,
        SUM(COALESCE(pc.weekly_capacity, 0) * m.alloc * (SELECT cnt FROM workdays) / 5.0) AS capacity_hours
      FROM member m
      JOIN active_role ar ON ar.person_id = m.person_id
      LEFT JOIN pcap pc ON pc.person_id = m.person_id
      GROUP BY m.squad_id, ar.role_type
    ),
    -- Draft + confirmed declarations both count.
    declared AS (
      SELECT
        mrd.squad_id,
        dre.role_type::text AS role_type,
        SUM(dre.declared_hours) AS declared_hours
      FROM declaration_role_entries dre
      JOIN monthly_role_declarations mrd ON mrd.id = dre.declaration_id
      WHERE mrd.month >= ${monthDate}::date
        AND mrd.month <= ${monthEnd}::date
      GROUP BY mrd.squad_id, dre.role_type
    ),
    billable AS (
      SELECT
        hr.squad_id,
        hr.role_type::text AS role_type,
        SUM(hr.hours) AS billable_hours
      FROM hour_records hr
      WHERE hr.date >= ${monthDate}::date
        AND hr.date <= ${monthEnd}::date
        AND NOT hr.is_non_billable
        AND hr.role_type IS NOT NULL
      GROUP BY hr.squad_id, hr.role_type
    ),
    nb_total AS (
      SELECT hr.person_id, SUM(hr.hours) AS nb_hours
      FROM hour_records hr
      WHERE hr.date >= ${monthDate}::date
        AND hr.date <= ${monthEnd}::date
        AND hr.is_non_billable
      GROUP BY hr.person_id
    ),
    nb_role AS (
      SELECT
        m.squad_id,
        ar.role_type,
        SUM(nt.nb_hours * m.alloc / at.total_alloc) AS nonbillable_hours
      FROM nb_total nt
      JOIN member m ON m.person_id = nt.person_id
      JOIN alloc_total at ON at.person_id = nt.person_id AND at.total_alloc > 0
      JOIN active_role ar ON ar.person_id = nt.person_id
      GROUP BY m.squad_id, ar.role_type
    ),
    keys AS (
      SELECT squad_id, role_type FROM role_capacity
      UNION
      SELECT squad_id, role_type FROM declared
      UNION
      SELECT squad_id, role_type FROM billable
      UNION
      SELECT squad_id, role_type FROM nb_role
    )
    SELECT
      s.id   AS squad_id,
      s.name AS squad_name,
      k.role_type,
      COALESCE(rc.capacity_hours, 0)::float   AS capacity_hours,
      COALESCE(d.declared_hours, 0)::float    AS declared_hours,
      COALESCE(b.billable_hours, 0)::float    AS billable_hours,
      COALESCE(nr.nonbillable_hours, 0)::float AS nonbillable_hours
    FROM keys k
    JOIN squads s ON s.id = k.squad_id AND s.is_active = true
    LEFT JOIN role_capacity rc ON rc.squad_id = k.squad_id AND rc.role_type = k.role_type
    LEFT JOIN declared d ON d.squad_id = k.squad_id AND d.role_type = k.role_type
    LEFT JOIN billable b ON b.squad_id = k.squad_id AND b.role_type = k.role_type
    LEFT JOIN nb_role nr ON nr.squad_id = k.squad_id AND nr.role_type = k.role_type
    ORDER BY s.name, k.role_type
  `);

  return NextResponse.json(rows);
}
