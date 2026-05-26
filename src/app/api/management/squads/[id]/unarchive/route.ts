import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const squad = await prisma.squad.update({
    where: { id: Number(id) },
    data: { isActive: true },
    select: { id: true, name: true, isActive: true },
  });

  return NextResponse.json(squad);
}
