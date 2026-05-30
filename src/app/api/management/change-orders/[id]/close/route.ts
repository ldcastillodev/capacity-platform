import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const co = await prisma.changeOrder.findUnique({ where: { id: Number(id) } });
    if (!co) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (co.status !== "active")
      return NextResponse.json({ error: "Only active change orders can be closed." }, { status: 400 });

    const row = await prisma.changeOrder.update({
      where: { id: Number(id) },
      data: { status: "closed" },
      select: { id: true, status: true },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
