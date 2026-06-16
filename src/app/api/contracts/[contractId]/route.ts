import { NextRequest, NextResponse } from "next/server";
import { contractService } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const { contractId } = await params;
  const contract = await contractService.findContractWithSowAndDeclarations(Number(contractId));
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(contract);
}
