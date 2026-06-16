import { NextRequest, NextResponse } from "next/server";
import { componentMappingService, hourRecordService } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { contract_id?: number; jira_instance?: string };

  // BR-2/BR-8: retargeting a mapping in place silently re-routes backdated
  // re-syncs of its whole effective window. Once hours were attributed
  // through this mapping, require archive + new mapping instead.
  if (body.contract_id !== undefined) {
    const current = await componentMappingService.findComponentMappingById(Number(id));
    if (!current) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (body.contract_id !== current.contractId) {
      const dependentHours = await hourRecordService.countHoursByContractWindow(
        current.contractId,
        current.effectiveFrom,
        current.effectiveTo
      );
      if (dependentHours > 0) {
        return NextResponse.json(
          {
            error: `Cannot retarget: ${dependentHours} hour record(s) were attributed through this mapping's effective window. Archive it and create a new mapping instead.`,
          },
          { status: 409 }
        );
      }
    }
  }

  const mapping = await componentMappingService.updateComponentMapping(Number(id), {
    ...(body.contract_id !== undefined && { contractId: body.contract_id }),
    ...(body.jira_instance !== undefined && { jiraInstance: body.jira_instance }),
  });
  return NextResponse.json(mapping);
}
