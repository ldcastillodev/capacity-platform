import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const decl = await prisma.monthlyRoleDeclaration.findUnique({ where: { id: Number(id) } });
    if (!decl) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (decl.status !== "draft")
      return NextResponse.json({ error: "Only draft declarations can be confirmed." }, { status: 400 });

    const body = await req.json() as { submitted_by: number };
    if (!body.submitted_by)
      return NextResponse.json({ error: "submitted_by is required." }, { status: 400 });

    const row = await prisma.monthlyRoleDeclaration.update({
      where: { id: Number(id) },
      data: { status: "confirmed", submittedBy: body.submitted_by, submittedAt: new Date() },
      select: { id: true, status: true, submittedBy: true, submittedAt: true },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
