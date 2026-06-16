import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Reopens an archived (closed) contract back to active.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.contract.update({
    where: { id: Number(id) },
    data: { status: "active" },
  });
  return NextResponse.json({ success: true });
}
