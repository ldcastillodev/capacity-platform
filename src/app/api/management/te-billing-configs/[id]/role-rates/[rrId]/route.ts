import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; rrId: string }> },
) {
  const { rrId } = await params;
  try {
    await prisma.tEBillingRoleRate.delete({ where: { id: Number(rrId) } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
