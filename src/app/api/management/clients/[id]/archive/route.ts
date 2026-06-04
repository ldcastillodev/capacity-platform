import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const clientId = Number(id);

  const sowCount = await prisma.statementOfWork.count({ where: { clientId } });
  if (sowCount > 0) {
    return NextResponse.json(
      { error: "Cannot archive client with active statements of work." },
      { status: 400 },
    );
  }

  await prisma.client.update({
    where: { id: clientId },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
