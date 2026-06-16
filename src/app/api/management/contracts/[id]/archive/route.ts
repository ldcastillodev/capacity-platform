import { NextRequest, NextResponse } from "next/server";
import { contractService } from "@/lib/db";
import { ContractStatus } from "@prisma/client";

// Archiving a contract sets status="closed" so the sync guard stops routing
// worklogs here. No hard delete — historical HourRecords keep their contractId.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await contractService.setContractStatus(Number(id), ContractStatus.closed);
  return NextResponse.json({ success: true });
}
