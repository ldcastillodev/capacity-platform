import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json() as { contract_id?: number; jira_instance?: string };

  // BR-2/BR-8: retargeting a mapping in place silently re-routes backdated
  // re-syncs of its whole effective window. Once hours were attributed
  // through this mapping, require archive + new mapping instead.
  if (body.contract_id !== undefined) {
    const current = await prisma.jiraComponentClientMapping.findUnique({
      where: { id: Number(id) },
    });
    if (!current) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (body.contract_id !== current.contractId) {
      const dependentHours = await prisma.hourRecord.count({
        where: {
          contractId: current.contractId,
          date: {
            gte: current.effectiveFrom,
            ...(current.effectiveTo ? { lte: current.effectiveTo } : {}),
          },
        },
      });
      if (dependentHours > 0) {
        return NextResponse.json(
          {
            error: `Cannot retarget: ${dependentHours} hour record(s) were attributed through this mapping's effective window. Archive it and create a new mapping instead.`,
          },
          { status: 409 },
        );
      }
    }
  }

  const mapping = await prisma.jiraComponentClientMapping.update({
    where: { id: Number(id) },
    data: {
      ...(body.contract_id !== undefined && { contractId: body.contract_id }),
      ...(body.jira_instance !== undefined && { jiraInstance: body.jira_instance }),
    },
    select: {
      id: true,
      jiraInstance: true,
      componentKey: true,
      contractId: true,
      effectiveFrom: true,
      effectiveTo: true,
      contract: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(mapping);
}
