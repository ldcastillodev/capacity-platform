export type SimulationVerdict = "ok" | "over" | "ambiguous";

export type SimulationMemberInput = {
  personId: number;
  personName: string;
  allocationPct: number;
  capacityHours: number;
  recentAvgHours: number;
};

export type SimulationMemberOutput = SimulationMemberInput & {
  availableHours: number;
};

export type SimulationOutput = {
  availableHours: number;
  gapHours: number;
  verdict: SimulationVerdict;
  members: SimulationMemberOutput[];
};

export type SimulationRoleInput = {
  roleType: string;
  requiredHours: number;
  capacityHours: number;
  recentAvgHours: number;
};

export type SimulationRoleOutput = SimulationRoleInput & {
  availableHours: number;
  gapHours: number;
  verdict: SimulationVerdict;
};

// Per-role check is independent: a member with multiple roles contributes
// full capacity to each role they hold.
export function computeRoleBreakdown(
  roles: SimulationRoleInput[],
): SimulationRoleOutput[] {
  return roles.map((r) => {
    const availableHours = Math.max(0, r.capacityHours - r.recentAvgHours);
    const gapHours = r.requiredHours - availableHours;
    let verdict: SimulationVerdict;
    if (r.capacityHours === 0) verdict = "ambiguous";
    else if (r.requiredHours <= availableHours) verdict = "ok";
    else verdict = "over";
    return { ...r, availableHours, gapHours, verdict };
  });
}

export function computeSimulation(
  members: SimulationMemberInput[],
  requiredHours: number,
): SimulationOutput {
  const enriched: SimulationMemberOutput[] = members.map((m) => ({
    ...m,
    availableHours: Math.max(0, m.capacityHours - m.recentAvgHours),
  }));

  enriched.sort((a, b) => b.availableHours - a.availableHours);

  const totalCapacity = enriched.reduce((acc, m) => acc + m.capacityHours, 0);
  const availableHours = enriched.reduce((acc, m) => acc + m.availableHours, 0);
  const gapHours = requiredHours - availableHours;

  let verdict: SimulationVerdict;
  if (enriched.length === 0 || totalCapacity === 0) {
    verdict = "ambiguous";
  } else if (requiredHours <= availableHours) {
    verdict = "ok";
  } else {
    verdict = "over";
  }

  return { availableHours, gapHours, verdict, members: enriched };
}
