import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Archiving a contract sets status="closed" so the sync guard stops routing
// worklogs here. No hard delete — historical HourRecords keep their contractId.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.contract.update({
    where: { id: Number(id) },
    data: { status: "closed" },
  });
  return NextResponse.json({ success: true });
}
