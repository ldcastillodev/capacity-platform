import { NextRequest, NextResponse } from "next/server";
import { contractService } from "@/lib/db";
import { ContractStatus } from "@prisma/client";

// Reopens an archived (closed) contract back to active.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await contractService.setContractStatus(Number(id), ContractStatus.active);
  return NextResponse.json({ success: true });
}
