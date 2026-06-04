import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json() as { contract_id?: number; jira_instance?: string };

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
