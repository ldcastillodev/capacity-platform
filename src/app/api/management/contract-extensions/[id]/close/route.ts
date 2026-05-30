import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const ext = await prisma.contractExtension.findUnique({ where: { id: Number(id) } });
    if (!ext) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (ext.status !== "approved")
      return NextResponse.json({ error: "Only approved extensions can be closed." }, { status: 400 });

    const row = await prisma.contractExtension.update({
      where: { id: Number(id) },
      data: { status: "closed" },
      select: {
        id: true, clientId: true, month: true, type: true, status: true,
        requestedHours: true, roleType: true,
        client: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
