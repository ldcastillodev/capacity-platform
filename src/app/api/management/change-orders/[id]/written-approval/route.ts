import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const co = await prisma.changeOrder.findUnique({ where: { id: Number(id) } });
    if (!co) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (co.status !== "pending_written")
      return NextResponse.json({ error: "Change order must be in pending_written status." }, { status: 400 });

    const body = await req.json() as { written_approval_ref: string };
    if (!body.written_approval_ref)
      return NextResponse.json({ error: "written_approval_ref is required." }, { status: 400 });

    const row = await prisma.changeOrder.update({
      where: { id: Number(id) },
      data: {
        status: "pending_docusign",
        writtenApprovalRef: body.written_approval_ref,
        writtenApprovalAt: new Date(),
      },
      select: { id: true, status: true, writtenApprovalRef: true, writtenApprovalAt: true },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
