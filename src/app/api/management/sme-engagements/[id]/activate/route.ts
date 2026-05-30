import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const sme = await prisma.sMEEngagement.findUnique({ where: { id: Number(id) } });
    if (!sme) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (sme.status !== "confirmed")
      return NextResponse.json({ error: "Only confirmed engagements can be activated." }, { status: 400 });

    const row = await prisma.sMEEngagement.update({
      where: { id: Number(id) },
      data: { status: "active" },
      select: { id: true, status: true },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
