import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  computeMemberRoles,
  computeRoleBreakdown,
  computeSimulation,
  worstVerdict,
  type SimulationMemberInput,
  type SimulationRoleInput,
} from "@/lib/simulator";

const ROLE_TYPES = [
  "dev", "devops", "qa", "design", "product",
  "project", "tl", "sre", "data", "seo", "content",
] as const;

const bodySchema = z
  .object({
    squadId: z.coerce.number().int().positive(),
    requiredHours: z.coerce.number().positive(),
    roles: z
      .array(
        z.object({
          roleType: z.enum(ROLE_TYPES),
          hours: z.coerce.number().positive(),
        }),
      )
      .min(1),
  })
  .superRefine((val, ctx) => {
    const seen = new Set<string>();
    for (const r of val.roles) {
      if (seen.has(r.roleType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["roles"],
          message: "Duplicate role",
        });
        return;
      }
      seen.add(r.roleType);
    }
    const sum = val.roles.reduce((a, r) => a + r.hours, 0);
    if (Math.abs(sum - val.requiredHours) > 1e-6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roles"],
        message: `Sum of role hours (${sum}) must equal required hours (${val.requiredHours})`,
      });
    }
  });

type MemberRow = {
  person_id: number;
  person_name: string;
  allocation_pct: number;
  capacity_hours: number;
  m3_hours: number;
  m2_hours: number;
  m1_hours: number;
  unassigned_avg: number;
};

function ymKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { squadId, requiredHours, roles: roleRequests } = parsed.data;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const m1Start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const m2Start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  const m3Start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1));

  const squad = await prisma.squad.findUnique({ where: { id: squadId } });
  if (!squad || !squad.isActive) {
    return NextResponse.json({ error: "Squad not found or inactive" }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<MemberRow[]>(Prisma.sql`
    SELECT
      p.id AS person_id,
      p.name AS person_name,
      sm.allocation_pct::float AS allocation_pct,
      (
        p.weekly_capacity_hours * sm.allocation_pct * (
          SELECT COUNT(*)::numeric
          FROM generate_series(${monthStart}::date, ${monthEnd}::date, '1 day'::interval) d
          WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
        ) / 5.0
      )::float AS capacity_hours,
      COALESCE(SUM(hr.hours) FILTER (
        WHERE hr.date >= ${m3Start}::date AND hr.date < ${m2Start}::date AND hr.is_non_billable = false
      ), 0)::float AS m3_hours,
      COALESCE(SUM(hr.hours) FILTER (
        WHERE hr.date >= ${m2Start}::date AND hr.date < ${m1Start}::date AND hr.is_non_billable = false
      ), 0)::float AS m2_hours,
      COALESCE(SUM(hr.hours) FILTER (
        WHERE hr.date >= ${m1Start}::date AND hr.date < ${monthStart}::date AND hr.is_non_billable = false
      ), 0)::float AS m1_hours,
      (COALESCE(SUM(hr.hours) FILTER (
        WHERE hr.date >= ${m3Start}::date AND hr.date < ${monthStart}::date
          AND hr.is_non_billable = false AND hr.role_type IS NULL
      ), 0) / 3.0)::float AS unassigned_avg
    FROM squad_memberships sm
    JOIN persons p ON p.id = sm.person_id AND p.is_active = true
    LEFT JOIN hour_records hr ON hr.person_id = p.id
    WHERE sm.squad_id = ${squadId}
      AND sm.effective_from <= ${monthEnd}::date
      AND (sm.effective_to IS NULL OR sm.effective_to >= ${monthStart}::date)
    GROUP BY p.id, p.name, sm.allocation_pct, p.weekly_capacity_hours
    ORDER BY p.name
  `);

  const monthlyLabels = [ymKey(m3Start), ymKey(m2Start), ymKey(m1Start)];

  const memberInputs: (SimulationMemberInput & { monthlyBillable: number[] })[] = rows.map((r) => {
    const monthlyBillable = [r.m3_hours, r.m2_hours, r.m1_hours];
    const recentAvgHours = (r.m3_hours + r.m2_hours + r.m1_hours) / 3;
    return {
      personId: r.person_id,
      personName: r.person_name,
      allocationPct: r.allocation_pct,
      capacityHours: r.capacity_hours,
      recentAvgHours,
      monthlyBillable,
    };
  });

  const sim = computeSimulation(memberInputs, requiredHours);

  const membersWithMonthly = sim.members.map((m) => {
    const src = memberInputs.find((i) => i.personId === m.personId);
    return { ...m, monthlyBillable: src?.monthlyBillable ?? [0, 0, 0] };
  });

  type RoleAggRow = {
    role_type: string;
    capacity_hours: number;
    recent_avg_hours: number;
  };

  const roleList = roleRequests.map((r) => r.roleType);
  const roleSqlList = Prisma.join(
    roleList.map((r) => Prisma.sql`${r}::"RoleType"`),
  );

  const roleRows = await prisma.$queryRaw<RoleAggRow[]>(Prisma.sql`
    SELECT
      pr.role_type::text AS role_type,
      COALESCE(SUM(
        p.weekly_capacity_hours * sm.allocation_pct * (
          SELECT COUNT(*)::numeric
          FROM generate_series(${monthStart}::date, ${monthEnd}::date, '1 day'::interval) d
          WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
        ) / 5.0
      ), 0)::float AS capacity_hours,
      COALESCE(SUM(role_hr.recent_avg), 0)::float AS recent_avg_hours
    FROM person_roles pr
    JOIN persons p ON p.id = pr.person_id AND p.is_active = true
    JOIN squad_memberships sm ON sm.person_id = pr.person_id AND sm.squad_id = ${squadId}
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(hr.hours) FILTER (
        WHERE hr.date >= ${m3Start}::date AND hr.date < ${monthStart}::date
          AND hr.is_non_billable = false
          AND hr.role_type = pr.role_type
      ), 0) / 3.0 AS recent_avg
      FROM hour_records hr
      WHERE hr.person_id = p.id
    ) role_hr ON true
    WHERE pr.role_type IN (${roleSqlList})
      AND pr.effective_from <= ${monthEnd}::date
      AND (pr.effective_to IS NULL OR pr.effective_to >= ${monthStart}::date)
      AND sm.effective_from <= ${monthEnd}::date
      AND (sm.effective_to IS NULL OR sm.effective_to >= ${monthStart}::date)
    GROUP BY pr.role_type
  `);

  const roleInputs: SimulationRoleInput[] = roleRequests.map((req) => {
    const row = roleRows.find((r) => r.role_type === req.roleType);
    return {
      roleType: req.roleType,
      requiredHours: req.hours,
      capacityHours: row?.capacity_hours ?? 0,
      recentAvgHours: row?.recent_avg_hours ?? 0,
    };
  });

  const roleBreakdown = computeRoleBreakdown(roleInputs);

  type MemberRoleRow = {
    person_id: number;
    role_type: string;
    recent_avg_hours: number;
  };

  const memberRoleRows = await prisma.$queryRaw<MemberRoleRow[]>(Prisma.sql`
    SELECT
      pr.person_id,
      pr.role_type::text AS role_type,
      COALESCE((
        SELECT SUM(hr.hours) FILTER (
          WHERE hr.date >= ${m3Start}::date AND hr.date < ${monthStart}::date
            AND hr.is_non_billable = false
            AND hr.role_type = pr.role_type
        )
        FROM hour_records hr
        WHERE hr.person_id = pr.person_id
      ), 0)::float / 3.0 AS recent_avg_hours
    FROM person_roles pr
    JOIN persons p ON p.id = pr.person_id AND p.is_active = true
    WHERE pr.role_type IN (${roleSqlList})
      AND pr.effective_from <= ${monthEnd}::date
      AND (pr.effective_to IS NULL OR pr.effective_to >= ${monthStart}::date)
      AND EXISTS (
        SELECT 1 FROM squad_memberships sm
        WHERE sm.person_id = pr.person_id
          AND sm.squad_id = ${squadId}
          AND sm.effective_from <= ${monthEnd}::date
          AND (sm.effective_to IS NULL OR sm.effective_to >= ${monthStart}::date)
      )
    GROUP BY pr.person_id, pr.role_type
  `);

  const membersOut = membersWithMonthly.map((m) => {
    const src = rows.find((r) => r.person_id === m.personId);
    const personRoleRows = memberRoleRows
      .filter((rr) => rr.person_id === m.personId)
      .map((rr) => ({ roleType: rr.role_type, recentAvgHours: rr.recent_avg_hours }));
    return {
      ...m,
      roles: computeMemberRoles(m.capacityHours, personRoleRows, roleRequests),
      unassignedAvgHours: src?.unassigned_avg ?? 0,
    };
  });

  // Headline numbers reflect capacity within the requested roles, not the
  // whole squad — a squad absorbs an engagement role by role.
  const roleAvailableHours = roleBreakdown.reduce((a, r) => a + r.availableHours, 0);

  return NextResponse.json({
    squadId,
    squadName: squad.name,
    month: ymKey(monthStart),
    requiredHours,
    availableHours: roleAvailableHours,
    gapHours: requiredHours - roleAvailableHours,
    verdict: worstVerdict(sim.verdict, ...roleBreakdown.map((r) => r.verdict)),
    members: membersOut,
    monthlyLabels,
    roleBreakdown,
  });
}
