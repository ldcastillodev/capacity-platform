import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const sme = await prisma.sMEEngagement.findUnique({ where: { id: Number(id) } });
    if (!sme) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (sme.status !== "requested")
      return NextResponse.json({ error: "Only requested engagements can be confirmed." }, { status: 400 });

    const body = await req.json() as { approved_by: number };
    if (!body.approved_by)
      return NextResponse.json({ error: "approved_by is required." }, { status: 400 });

    const row = await prisma.sMEEngagement.update({
      where: { id: Number(id) },
      data: { status: "confirmed", approvedBy: body.approved_by },
      select: { id: true, status: true, approvedBy: true },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
