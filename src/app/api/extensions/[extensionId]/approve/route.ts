import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ extensionId: string }> },
) {
  const { extensionId } = await params;
  const ext = await prisma.contractExtension.update({
    where: { id: Number(extensionId) },
    data: { status: "approved", approvedAt: new Date() },
  });
  return NextResponse.json(ext);
}
