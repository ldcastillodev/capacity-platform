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

  const squadIdParam = searchParams.get("squad_id");
  const squadId = squadIdParam ? Number(squadIdParam) : null;

  if (squadId !== null && Number.isFinite(squadId)) {
    // Squad-scoped members: capacity weighted by allocation_pct so member rows
    // sum to the squad-capacity formula; consumed = hours attributed to this squad.
    const rows = await prisma.$queryRaw<
      {
        person_id: number;
        person_name: string;
        squad_names: string;
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
        SELECT sm.person_id, SUM(sm.allocation_pct) AS alloc
        FROM squad_memberships sm
        WHERE sm.squad_id = ${squadId}
          AND sm.effective_from <= ${monthEnd}::date
          AND (sm.effective_to IS NULL OR sm.effective_to >= ${monthDate}::date)
        GROUP BY sm.person_id
      ),
      actual AS (
        SELECT
          hr.person_id,
          SUM(hr.hours) FILTER (WHERE NOT hr.is_non_billable) AS billable_hours,
          SUM(hr.hours) FILTER (WHERE hr.is_non_billable)     AS nonbillable_hours
        FROM hour_records hr
        WHERE hr.date >= ${monthDate}::date
          AND hr.date <= ${monthEnd}::date
          AND hr.squad_id = ${squadId}
        GROUP BY hr.person_id
      )
      SELECT
        p.id   AS person_id,
        p.name AS person_name,
        '—'    AS squad_names,
        (COALESCE(pc.weekly_capacity, 0) * COALESCE(m.alloc, 0) * (SELECT cnt FROM workdays) / 5.0)::float AS capacity_hours,
        COALESCE(a.billable_hours, 0)::float    AS billable_hours,
        COALESCE(a.nonbillable_hours, 0)::float AS nonbillable_hours
      FROM persons p
      LEFT JOIN pcap pc ON pc.person_id = p.id
      LEFT JOIN member m ON m.person_id = p.id
      LEFT JOIN actual a ON a.person_id = p.id
      WHERE m.person_id IS NOT NULL OR a.person_id IS NOT NULL
      ORDER BY p.name
    `);
    return NextResponse.json(rows);
  }

  const rows = await prisma.$queryRaw<
    {
      person_id: number;
      person_name: string;
      squad_names: string;
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
      SELECT
        hr.person_id,
        SUM(hr.hours) FILTER (WHERE NOT hr.is_non_billable) AS billable_hours,
        SUM(hr.hours) FILTER (WHERE hr.is_non_billable)     AS nonbillable_hours
      FROM hour_records hr
      WHERE hr.date >= ${monthDate}::date
        AND hr.date <= ${monthEnd}::date
      GROUP BY hr.person_id
    )
    SELECT
      p.id   AS person_id,
      p.name AS person_name,
      COALESCE(ps.squad_names, '—') AS squad_names,
      (COALESCE(pc.weekly_capacity, 0) * (SELECT cnt FROM workdays) / 5.0)::float AS capacity_hours,
      COALESCE(a.billable_hours, 0)::float    AS billable_hours,
      COALESCE(a.nonbillable_hours, 0)::float AS nonbillable_hours
    FROM persons p
    LEFT JOIN pcap pc ON pc.person_id = p.id
    LEFT JOIN person_squads ps ON ps.person_id = p.id
    LEFT JOIN actual a ON a.person_id = p.id
    -- Active-in-period = had a membership or logged hours that month,
    -- not is_active today (a person deactivated later still counts).
    WHERE ps.person_id IS NOT NULL OR a.person_id IS NOT NULL
    ORDER BY p.name
  `);

  return NextResponse.json(rows);
}
