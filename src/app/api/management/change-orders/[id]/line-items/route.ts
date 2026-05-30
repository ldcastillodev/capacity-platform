import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const PRE_APPROVED = ["pending_written", "pending_docusign"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const rows = await prisma.changeOrderLineItem.findMany({
      where: { changeOrderId: Number(id) },
      orderBy: { roleType: "asc" },
      select: { id: true, changeOrderId: true, roleType: true, hours: true, rateOverride: true },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const co = await prisma.changeOrder.findUnique({ where: { id: Number(id) } });
    if (!co) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!PRE_APPROVED.includes(co.status))
      return NextResponse.json({ error: "Line items can only be added while the change order is pre-approval." }, { status: 400 });

    const body = await req.json() as { role_type: string; hours: number; rate_override?: number };
    const row = await prisma.changeOrderLineItem.create({
      data: {
        changeOrderId: Number(id),
        roleType: body.role_type as never,
        hours: body.hours,
        rateOverride: body.rate_override ?? null,
      },
      select: { id: true, changeOrderId: true, roleType: true, hours: true, rateOverride: true },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002")
      return NextResponse.json({ error: "Line item already exists for this role." }, { status: 400 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
