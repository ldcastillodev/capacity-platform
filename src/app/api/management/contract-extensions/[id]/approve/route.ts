import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const ext = await prisma.contractExtension.findUnique({ where: { id: Number(id) } });
    if (!ext) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (ext.status !== "pending_approval")
      return NextResponse.json({ error: "Only pending_approval extensions can be approved." }, { status: 400 });

    const body = await req.json() as { approved_by: number };
    if (!body.approved_by)
      return NextResponse.json({ error: "approved_by is required." }, { status: 400 });

    const row = await prisma.contractExtension.update({
      where: { id: Number(id) },
      data: {
        status: "approved",
        approvedBy: body.approved_by,
        approvedAt: new Date(),
      },
      select: {
        id: true, clientId: true, month: true, type: true, status: true,
        requestedHours: true, roleType: true, approvedBy: true, approvedAt: true,
        client: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
