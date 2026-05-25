import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ coId: string }> },
) {
  const { coId } = await params;
  const body = await req.json() as { written_approval_ref: string };

  const order = await prisma.changeOrder.update({
    where: { id: Number(coId) },
    data: {
      writtenApprovalRef: body.written_approval_ref,
      writtenApprovalAt: new Date(),
      status: "pending_docusign",
    },
  });
  return NextResponse.json(order);
}
