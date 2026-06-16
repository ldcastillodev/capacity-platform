import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { squadService, analyticsRawService } from "@/lib/db";
import {
  computeMemberRoles,
  computeRoleBreakdown,
  computeSimulation,
  worstVerdict,
  type SimulationMemberInput,
  type SimulationRoleInput,
} from "@/lib/simulator";

const ROLE_TYPES = [
  "dev",
  "devops",
  "qa",
  "design",
  "product",
  "project",
  "tl",
  "sre",
  "data",
  "seo",
  "content",
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
        })
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

  const squad = await squadService.findSquadById(squadId);
  if (!squad || !squad.isActive) {
    return NextResponse.json({ error: "Squad not found or inactive" }, { status: 400 });
  }

  const roleTypes = roleRequests.map((r) => r.roleType);

  const rows = await analyticsRawService.getSquadMemberCapacity({
    squadId,
    monthStart,
    monthEnd,
    m1Start,
    m2Start,
    m3Start,
  });

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

  const roleRows = await analyticsRawService.getRoleCapacityAggregate({
    squadId,
    monthStart,
    monthEnd,
    m3Start,
    roleTypes,
  });

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

  const memberRoleRows = await analyticsRawService.getMemberRoleRecentHours({
    squadId,
    monthStart,
    monthEnd,
    m3Start,
    roleTypes,
  });

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
