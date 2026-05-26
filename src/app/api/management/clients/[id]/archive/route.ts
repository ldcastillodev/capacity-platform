import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const clientId = Number(id);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`UPDATE retainer_contracts SET status = 'closed' WHERE client_id = ${clientId} AND status != 'closed'`;
    await tx.client.update({
      where: { id: clientId },
      data: { isActive: false },
    });
  });

  return NextResponse.json({ success: true });
}
