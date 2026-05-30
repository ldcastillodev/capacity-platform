import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const co = await prisma.changeOrder.findUnique({ where: { id: Number(id) } });
    if (!co) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (co.status === "closed")
      return NextResponse.json({ error: "Change order is closed and cannot be edited." }, { status: 400 });

    const body = await req.json() as { notes?: string | null };
    const row = await prisma.changeOrder.update({
      where: { id: Number(id) },
      data: {
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      select: {
        id: true, clientId: true, squadId: true, status: true,
        dateRangeStart: true, dateRangeEnd: true,
        writtenApprovalRef: true, writtenApprovalAt: true,
        docusignEnvelopeId: true, docusignSignedAt: true, notes: true, createdAt: true,
        client: { select: { id: true, name: true } },
        squad: { select: { id: true, name: true } },
        _count: { select: { lineItems: true } },
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
