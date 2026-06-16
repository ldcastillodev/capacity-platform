import { NextRequest, NextResponse } from "next/server";
import { clientService } from "@/lib/db";

// BR-5: archiving a client cascades — all non-closed contracts under its
// SOWs are closed and their open component mappings end-dated, so the sync
// guard stops routing worklogs here. Unarchive restores the client flag
// only: which contracts were active beforehand is not recorded, so children
// stay closed and must be reopened explicitly if needed.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await clientService.archiveClientCascade(Number(id));
  return NextResponse.json({ success: true });
}
