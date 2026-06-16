import { NextRequest, NextResponse } from "next/server";
import { contractService } from "@/lib/db";

// Restores the SOW active flag only. Contracts closed by the archive cascade
// are not reopened (which were active beforehand is not recorded).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await contractService.setStatementOfWorkActive(Number(id), true);
  return NextResponse.json({ success: true });
}
