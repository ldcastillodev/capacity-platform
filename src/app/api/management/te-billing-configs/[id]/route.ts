import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await req.json() as { type?: string; value?: number | null; currency?: string | null };
    const row = await prisma.tEBillingConfig.update({
      where: { id: Number(id) },
      data: {
        ...(body.type !== undefined && { type: body.type as never }),
        ...(body.value !== undefined && { value: body.value }),
        ...(body.currency !== undefined && { currency: body.currency as never }),
      },
      select: {
        id: true, clientId: true, type: true, value: true, currency: true,
        client: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await prisma.tEBillingConfig.delete({ where: { id: Number(id) } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
