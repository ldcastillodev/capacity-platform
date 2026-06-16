import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Restores the SOW active flag only. Contracts closed by the archive cascade
// are not reopened (which were active beforehand is not recorded).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.statementOfWork.update({
    where: { id: Number(id) },
    data: { isActive: true },
  });
  return NextResponse.json({ success: true });
}
