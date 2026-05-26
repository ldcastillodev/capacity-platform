import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const mapping = await prisma.jiraComponentClientMapping.update({
    where: { id: Number(id) },
    data: { effectiveTo: null },
    select: { id: true, componentKey: true, effectiveTo: true },
  });

  return NextResponse.json(mapping);
}
