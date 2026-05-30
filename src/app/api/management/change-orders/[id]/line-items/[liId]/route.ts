import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const PRE_APPROVED = ["pending_written", "pending_docusign"];

async function guardCO(coId: number) {
  const co = await prisma.changeOrder.findUnique({ where: { id: coId } });
  if (!co) return "Change order not found.";
  if (!PRE_APPROVED.includes(co.status)) return "Line items are locked once the change order is approved.";
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; liId: string }> },
) {
  const { id, liId } = await params;
  try {
    const err = await guardCO(Number(id));
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const body = await req.json() as { hours?: number; rate_override?: number | null };
    const row = await prisma.changeOrderLineItem.update({
      where: { id: Number(liId) },
      data: {
        ...(body.hours !== undefined && { hours: body.hours }),
        ...(body.rate_override !== undefined && { rateOverride: body.rate_override }),
      },
      select: { id: true, changeOrderId: true, roleType: true, hours: true, rateOverride: true },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; liId: string }> },
) {
  const { id, liId } = await params;
  try {
    const err = await guardCO(Number(id));
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    await prisma.changeOrderLineItem.delete({ where: { id: Number(liId) } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
