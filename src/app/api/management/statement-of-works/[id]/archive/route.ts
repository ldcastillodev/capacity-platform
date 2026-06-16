import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toUtcDateOnly } from "@/lib/temporal";

// Archiving a SOW cascades (mirrors client archive, one level down): all
// non-closed contracts under it are closed and their open component mappings
// end-dated, so the sync guard stops routing worklogs here. Unarchive restores
// the SOW flag only — children stay closed and must be reopened explicitly.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sowId = Number(id);
  const today = toUtcDateOnly(new Date());

  await prisma.$transaction(async (tx) => {
    await tx.contract.updateMany({
      where: { sowId, status: { not: "closed" } },
      data: { status: "closed" },
    });
    await tx.jiraComponentClientMapping.updateMany({
      where: {
        effectiveTo: null,
        effectiveFrom: { lte: today },
        contract: { sowId },
      },
      data: { effectiveTo: today },
    });
    await tx.statementOfWork.update({
      where: { id: sowId },
      data: { isActive: false },
    });
  });

  return NextResponse.json({ success: true });
}
