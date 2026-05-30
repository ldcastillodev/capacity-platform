import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const decl = await prisma.monthlyRoleDeclaration.findUnique({ where: { id: Number(id) } });
    if (!decl) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (decl.status !== "confirmed")
      return NextResponse.json({ error: "Only confirmed declarations can be locked." }, { status: 400 });

    const row = await prisma.monthlyRoleDeclaration.update({
      where: { id: Number(id) },
      data: { status: "locked" },
      select: { id: true, status: true },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
