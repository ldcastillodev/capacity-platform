import { NextRequest, NextResponse } from "next/server";
import { contractService } from "@/lib/db";

// Archiving a SOW cascades (mirrors client archive, one level down): all
// non-closed contracts under it are closed and their open component mappings
// end-dated, so the sync guard stops routing worklogs here. Unarchive restores
// the SOW flag only — children stay closed and must be reopened explicitly.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await contractService.archiveStatementOfWorkCascade(Number(id));
  return NextResponse.json({ success: true });
}
