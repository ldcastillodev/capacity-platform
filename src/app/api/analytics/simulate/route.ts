import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET — list saved simulations
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");

  const simulations = await prisma.clientSimulation.findMany({
    where: clientId ? { clientId: Number(clientId) } : undefined,
    include: { lineItems: true, client: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(simulations);
}

// POST — run feasibility simulation (does NOT persist)
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    proposed_client_name: string;
    proposed_start_month: string;
    proposed_pool_hours: number;
    role_breakdown: Array<{ role_type: string; hours_per_month: number }>;
  };

  const month = new Date(body.proposed_start_month);

  // Aggregate free hours per role across all squads for that month.
  // net_gap_hours > 0 means available capacity; < 0 means over-committed.
  const gaps = await prisma.staffingGapSnapshot.findMany({
    where: { month },
  });

  // Merge dev pool: frontend_dev | backend_dev | fullstack_dev → frontend_dev
  const DEV_ROLES = new Set(["frontend_dev", "backend_dev", "fullstack_dev"]);
  const freeByRole: Record<string, number> = {};
  for (const g of gaps) {
    const key = DEV_ROLES.has(g.roleType) ? "frontend_dev" : g.roleType;
    freeByRole[key] = (freeByRole[key] ?? 0) + Number(g.netGapHours);
  }

  type Action = "available" | "hire_needed" | "redistribute";
  const lineItems = body.role_breakdown.map((li) => {
    const roleKey = DEV_ROLES.has(li.role_type) ? "frontend_dev" : li.role_type;
    const available = freeByRole[roleKey] ?? 0;
    const gap = available - li.hours_per_month;
    let action: Action;
    let ftesToHire = 0;
    if (gap >= 0) {
      action = "available";
    } else if (available > 0) {
      action = "redistribute";
      ftesToHire = 0;
    } else {
      action = "hire_needed";
      // Rough FTE estimate: assume 140 billable h/month per FTE
      ftesToHire = Math.ceil(Math.abs(gap) / 140);
    }
    return {
      role_type: li.role_type,
      requested_hours: li.hours_per_month,
      available_hours: Math.max(available, 0),
      gap_hours: gap,
      action,
      ftes_to_hire: ftesToHire,
    };
  });

  const feasible = lineItems.every((li) => li.action !== "hire_needed");
  const bottleneck = lineItems.find((li) => li.action === "hire_needed");

  return NextResponse.json({
    proposed_client_name: body.proposed_client_name,
    proposed_start_month: body.proposed_start_month,
    feasible,
    bottleneck_role: bottleneck?.role_type ?? null,
    line_items: lineItems,
  });
}
