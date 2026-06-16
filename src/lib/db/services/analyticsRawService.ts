import prisma from "@/lib/prisma";
import { Prisma, type RoleType } from "@prisma/client";
import type { Db } from "../types";

/**
 * Raw SQL analytics. These queries use PostgreSQL features (CTEs, LATERAL
 * joins, FILTER, generate_series, date math) that have no clean Prisma ORM
 * equivalent, so they stay raw — relocated verbatim with explicit result types.
 *
 * HourRecord (hour_records) remains the source of truth for actual hours;
 * declaration_role_entries is read only as the planned/committed pool.
 */

/** One row per (squad, role) for a month. */
export type RoleCapacityRow = {
  squad_id: number;
  squad_name: string;
  role_type: string;
  capacity_hours: number;
  declared_hours: number;
  billable_hours: number;
  nonbillable_hours: number;
};

/** One row per squad-member for a month (empty squads keep a null-person row). */
export type SquadCapacityRow = {
  squad_id: number;
  squad_name: string;
  person_id: number | null;
  person_name: string | null;
  capacity_hours: number;
  billable_hours: number;
  nonbillable_hours: number;
};

/** Non-billable hours and capacity per squad for a month. */
export type NbBySquadRow = {
  squad_id: number;
  squad_name: string;
  total_hours: number;
  capacity_hours: number;
  nb_pct: number;
};

/** A squad member's capacity and trailing 3-month billable hours (simulator). */
export type SimulateMemberRow = {
  person_id: number;
  person_name: string;
  allocation_pct: number;
  capacity_hours: number;
  m3_hours: number;
  m2_hours: number;
  m1_hours: number;
  unassigned_avg: number;
};

/** Per-role capacity and recent average billable hours (simulator). */
export type SimulateRoleAggRow = {
  role_type: string;
  capacity_hours: number;
  recent_avg_hours: number;
};

/** Per-(person, role) recent average billable hours (simulator). */
export type SimulateMemberRoleRow = {
  person_id: number;
  role_type: string;
  recent_avg_hours: number;
};

/**
 * Capacity / declared / billable / non-billable hours per (squad, role) for the
 * month. Capacity is pro-rated by day; non-billable is attributed to active
 * roles and split across squads by allocation share. Empty → [].
 */
export function getRoleCapacityByMonth(monthDate: Date, monthEnd: Date, db: Db = prisma) {
  return db.$queryRaw<RoleCapacityRow[]>(Prisma.sql`
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
}

/**
 * Capacity / billable / non-billable hours per squad-member for the month.
 * Capacity is pro-rated by day; non-billable splits across squads by allocation
 * share, with a recorded-squad fallback for members with no membership window.
 * Empty → [].
 */
export function getSquadCapacityByMonth(monthDate: Date, monthEnd: Date, db: Db = prisma) {
  return db.$queryRaw<SquadCapacityRow[]>(Prisma.sql`
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
}

/**
 * Non-billable hours, pro-rated capacity, and the resulting non-billable %
 * per active squad for the month (division-by-zero guarded). Empty → [].
 */
export function getNonBillableBySquad(monthDate: Date, monthEnd: Date, db: Db = prisma) {
  return db.$queryRaw<NbBySquadRow[]>(Prisma.sql`
    WITH nb AS (
      SELECT hr.squad_id, SUM(hr.hours) AS total_nb_hours
      FROM hour_records hr
      WHERE hr.is_non_billable = true
        AND hr.date >= ${monthDate}::date
        AND hr.date <= ${monthEnd}::date
      GROUP BY hr.squad_id
    ),
    workdays AS (
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
    capacity AS (
      SELECT
        sm.squad_id,
        SUM(pc.weekly_capacity * sm.allocation_pct * (SELECT cnt FROM workdays) / 5.0) AS capacity_hours
      FROM squad_memberships sm
      JOIN pcap pc ON pc.person_id = sm.person_id
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
}

/** Boundaries for a simulator run: current month + the three prior month starts. */
export type SimulateWindow = {
  squadId: number;
  monthStart: Date;
  monthEnd: Date;
  m1Start: Date;
  m2Start: Date;
  m3Start: Date;
};

/**
 * Per squad-member: pro-rated capacity, billable hours for each of the trailing
 * three months, and the trailing unassigned-work average. Empty → [].
 */
export function getSquadMemberCapacity(w: SimulateWindow, db: Db = prisma) {
  return db.$queryRaw<SimulateMemberRow[]>(Prisma.sql`
    SELECT
      p.id AS person_id,
      p.name AS person_name,
      sm.allocation_pct::float AS allocation_pct,
      (
        p.weekly_capacity_hours * sm.allocation_pct * (
          SELECT COUNT(*)::numeric
          FROM generate_series(${w.monthStart}::date, ${w.monthEnd}::date, '1 day'::interval) d
          WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
        ) / 5.0
      )::float AS capacity_hours,
      COALESCE(SUM(hr.hours) FILTER (
        WHERE hr.date >= ${w.m3Start}::date AND hr.date < ${w.m2Start}::date AND hr.is_non_billable = false
      ), 0)::float AS m3_hours,
      COALESCE(SUM(hr.hours) FILTER (
        WHERE hr.date >= ${w.m2Start}::date AND hr.date < ${w.m1Start}::date AND hr.is_non_billable = false
      ), 0)::float AS m2_hours,
      COALESCE(SUM(hr.hours) FILTER (
        WHERE hr.date >= ${w.m1Start}::date AND hr.date < ${w.monthStart}::date AND hr.is_non_billable = false
      ), 0)::float AS m1_hours,
      (COALESCE(SUM(hr.hours) FILTER (
        WHERE hr.date >= ${w.m3Start}::date AND hr.date < ${w.monthStart}::date
          AND hr.is_non_billable = false AND hr.role_type IS NULL
      ), 0) / 3.0)::float AS unassigned_avg
    FROM squad_memberships sm
    JOIN persons p ON p.id = sm.person_id AND p.is_active = true
    LEFT JOIN hour_records hr ON hr.person_id = p.id
    WHERE sm.squad_id = ${w.squadId}
      AND sm.effective_from <= ${w.monthEnd}::date
      AND (sm.effective_to IS NULL OR sm.effective_to >= ${w.monthStart}::date)
    GROUP BY p.id, p.name, sm.allocation_pct, p.weekly_capacity_hours
    ORDER BY p.name
  `);
}

/** Build a SQL list of `'role'::"RoleType"` literals for an `IN (...)` clause. */
function roleSqlList(roleTypes: RoleType[]): Prisma.Sql {
  return Prisma.join(roleTypes.map((r) => Prisma.sql`${r}::"RoleType"`));
}

/**
 * Per requested role within a squad: aggregate pro-rated capacity and recent
 * average billable hours. Empty → [].
 */
export function getRoleCapacityAggregate(
  args: { squadId: number; monthStart: Date; monthEnd: Date; m3Start: Date; roleTypes: RoleType[] },
  db: Db = prisma
) {
  const roles = roleSqlList(args.roleTypes);
  return db.$queryRaw<SimulateRoleAggRow[]>(Prisma.sql`
    SELECT
      pr.role_type::text AS role_type,
      COALESCE(SUM(
        p.weekly_capacity_hours * sm.allocation_pct * (
          SELECT COUNT(*)::numeric
          FROM generate_series(${args.monthStart}::date, ${args.monthEnd}::date, '1 day'::interval) d
          WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
        ) / 5.0
      ), 0)::float AS capacity_hours,
      COALESCE(SUM(role_hr.recent_avg), 0)::float AS recent_avg_hours
    FROM person_roles pr
    JOIN persons p ON p.id = pr.person_id AND p.is_active = true
    JOIN squad_memberships sm ON sm.person_id = pr.person_id AND sm.squad_id = ${args.squadId}
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(hr.hours) FILTER (
        WHERE hr.date >= ${args.m3Start}::date AND hr.date < ${args.monthStart}::date
          AND hr.is_non_billable = false
          AND hr.role_type = pr.role_type
      ), 0) / 3.0 AS recent_avg
      FROM hour_records hr
      WHERE hr.person_id = p.id
    ) role_hr ON true
    WHERE pr.role_type IN (${roles})
      AND pr.effective_from <= ${args.monthEnd}::date
      AND (pr.effective_to IS NULL OR pr.effective_to >= ${args.monthStart}::date)
      AND sm.effective_from <= ${args.monthEnd}::date
      AND (sm.effective_to IS NULL OR sm.effective_to >= ${args.monthStart}::date)
    GROUP BY pr.role_type
  `);
}

/**
 * Per (person, role) for the requested roles within a squad: recent average
 * billable hours over the trailing three months. Empty → [].
 */
export function getMemberRoleRecentHours(
  args: { squadId: number; monthStart: Date; monthEnd: Date; m3Start: Date; roleTypes: RoleType[] },
  db: Db = prisma
) {
  const roles = roleSqlList(args.roleTypes);
  return db.$queryRaw<SimulateMemberRoleRow[]>(Prisma.sql`
    SELECT
      pr.person_id,
      pr.role_type::text AS role_type,
      COALESCE((
        SELECT SUM(hr.hours) FILTER (
          WHERE hr.date >= ${args.m3Start}::date AND hr.date < ${args.monthStart}::date
            AND hr.is_non_billable = false
            AND hr.role_type = pr.role_type
        )
        FROM hour_records hr
        WHERE hr.person_id = pr.person_id
      ), 0)::float / 3.0 AS recent_avg_hours
    FROM person_roles pr
    JOIN persons p ON p.id = pr.person_id AND p.is_active = true
    WHERE pr.role_type IN (${roles})
      AND pr.effective_from <= ${args.monthEnd}::date
      AND (pr.effective_to IS NULL OR pr.effective_to >= ${args.monthStart}::date)
      AND EXISTS (
        SELECT 1 FROM squad_memberships sm
        WHERE sm.person_id = pr.person_id
          AND sm.squad_id = ${args.squadId}
          AND sm.effective_from <= ${args.monthEnd}::date
          AND (sm.effective_to IS NULL OR sm.effective_to >= ${args.monthStart}::date)
      )
    GROUP BY pr.person_id, pr.role_type
  `);
}
