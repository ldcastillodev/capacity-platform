import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toUtcDateOnly } from "@/lib/temporal";

// BR-5: archiving a client cascades — all non-closed contracts under its
// SOWs are closed and their open component mappings end-dated, so the sync
// guard stops routing worklogs here. Unarchive restores the client flag
// only: which contracts were active beforehand is not recorded, so children
// stay closed and must be reopened explicitly if needed.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const clientId = Number(id);
  const today = toUtcDateOnly(new Date());

  await prisma.$transaction(async (tx) => {
    const sowIds = (
      await tx.statementOfWork.findMany({ where: { clientId }, select: { id: true } })
    ).map(s => s.id);

    if (sowIds.length > 0) {
      await tx.contract.updateMany({
        where: { sowId: { in: sowIds }, status: { not: "closed" } },
        data: { status: "closed" },
      });
      await tx.jiraComponentClientMapping.updateMany({
        where: {
          effectiveTo: null,
          effectiveFrom: { lte: today },
          contract: { sowId: { in: sowIds } },
        },
        data: { effectiveTo: today },
      });
    }

    await tx.client.update({
      where: { id: clientId },
      data: { isActive: false },
    });
  });

  return NextResponse.json({ success: true });
}
