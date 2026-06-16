import { NextRequest, NextResponse } from "next/server";
import { componentMappingService, ConflictError } from "@/lib/db";
import { toUtcDateOnly } from "@/lib/temporal";

export async function GET() {
  const mappings = await componentMappingService.listComponentMappings();
  return NextResponse.json(mappings);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    component_key: string;
    contract_id: number;
    jira_instance?: string;
    effective_from?: string;
  };

  try {
    // BR-2: a component maps to exactly one contract at a time — end-date the
    // prior open mapping in the same transaction.
    const mapping = await componentMappingService.createMappingWithOverlapResolution({
      jiraInstance: body.jira_instance ?? "na",
      componentKey: body.component_key,
      contractId: body.contract_id,
      effectiveFrom: toUtcDateOnly(body.effective_from ?? new Date()),
    });
    return NextResponse.json(mapping, { status: 201 });
  } catch (e) {
    if (e instanceof ConflictError) return NextResponse.json({ error: e.message }, { status: 409 });
    if (String(e).includes("exclusion constraint"))
      return NextResponse.json(
        { error: "Overlapping mapping for this component's date range." },
        { status: 409 }
      );
    throw e;
  }
}
